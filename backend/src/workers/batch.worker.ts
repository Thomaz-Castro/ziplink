import { Worker, Job } from "bullmq";
import { PoolClient } from "pg";
import { getRedis } from "../config/redis";
import { getPool, withTransaction } from "../config/database";
import { env } from "../config/env";
import { BATCH_QUEUE_NAME } from "../queues/batch.queue";
import { generateSlug, isValidSlug } from "../utils/slug";
import { isValidUrl } from "../utils/url";
import { BatchResult } from "../types";

interface BatchPayload {
  jobId: string;
  userId: string;
  entries: Array<{ url: string; slug?: string; title?: string }>;
}

const CHUNK_SIZE = 100;

async function generateUniqueSlug(client: PoolClient): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const candidate = generateSlug(i < 3 ? 7 : 8);
    const exists = await client.query(`SELECT 1 FROM links WHERE slug = $1`, [candidate]);
    if (!exists.rows[0]) return candidate;
  }
  throw new Error("Falha ao gerar slug único — tente novamente");
}

export function createBatchWorker(): Worker {
  const worker = new Worker<BatchPayload>(
    BATCH_QUEUE_NAME,
    async (job: Job<BatchPayload>) => {
      const { jobId, userId, entries } = job.data;
      const results: BatchResult[] = [];
      let successCount = 0;
      let failureCount = 0;

      // Mark job as processing
      await getPool().query(
        `UPDATE batch_jobs SET status = 'processing' WHERE id = $1`,
        [jobId]
      );

      // Process in chunks to avoid long-running transactions
      for (let chunkStart = 0; chunkStart < entries.length; chunkStart += CHUNK_SIZE) {
        const chunk = entries.slice(chunkStart, chunkStart + CHUNK_SIZE);

        try {
          const chunkResults = await withTransaction(async (client) => {
            const batchResults: BatchResult[] = [];

            for (let i = 0; i < chunk.length; i++) {
              const entry = chunk[i];
              const lineNumber = chunkStart + i + 1;

              if (!isValidUrl(entry.url)) {
                batchResults.push({ line: lineNumber, url: entry.url, status: "error", error: "URL inválida" });
                continue;
              }

              if (entry.slug && !isValidSlug(entry.slug)) {
                batchResults.push({ line: lineNumber, url: entry.url, status: "error", error: "Formato de slug inválido" });
                continue;
              }

              try {
                const slug = entry.slug ?? await generateUniqueSlug(client);

                // Check custom slug uniqueness
                if (entry.slug) {
                  const exists = await client.query(`SELECT 1 FROM links WHERE slug = $1`, [slug]);
                  if (exists.rows[0]) {
                    batchResults.push({ line: lineNumber, url: entry.url, status: "error", error: `Slug '${slug}' já existe` });
                    continue;
                  }
                }

                await client.query(
                  `INSERT INTO links (user_id, slug, original_url, title)
                   VALUES ($1, $2, $3, $4)`,
                  [userId, slug, entry.url, entry.title ?? null]
                );

                batchResults.push({
                  line: lineNumber,
                  url: entry.url,
                  slug,
                  short_url: `${env.BASE_URL}/${slug}`,
                  status: "success",
                });
              } catch (err) {
                const message = err instanceof Error ? err.message : "Unknown error";
                batchResults.push({ line: lineNumber, url: entry.url, status: "error", error: message });
              }
            }

            return batchResults;
          });

          results.push(...chunkResults);
          successCount += chunkResults.filter((r) => r.status === "success").length;
          failureCount += chunkResults.filter((r) => r.status === "error").length;
        } catch (err) {
          // Whole chunk failed (transaction rollback)
          const message = err instanceof Error ? err.message : "Falha no processamento do lote";
          for (let i = 0; i < chunk.length; i++) {
            results.push({ line: chunkStart + i + 1, url: chunk[i].url, status: "error", error: message });
          }
          failureCount += chunk.length;
        }

        // Update progress after each chunk
        await getPool().query(
          `UPDATE batch_jobs SET processed = $1 WHERE id = $2`,
          [chunkStart + chunk.length, jobId]
        );

        await job.updateProgress(Math.round(((chunkStart + chunk.length) / entries.length) * 100));
      }

      // Finalize
      await getPool().query(
        `UPDATE batch_jobs
         SET status = 'completed', success_count = $1, failure_count = $2,
             processed = $3, results = $4::jsonb
         WHERE id = $5`,
        [successCount, failureCount, entries.length, JSON.stringify(results), jobId]
      );

      return { successCount, failureCount, total: entries.length };
    },
    {
      connection: getRedis(),
      concurrency: env.WORKER_CONCURRENCY,
    }
  );

  worker.on("failed", async (job, err) => {
    if (!job) return;
    console.error(`Batch job ${job.data.jobId} failed:`, err.message);
    await getPool().query(
      `UPDATE batch_jobs SET status = 'failed' WHERE id = $1`,
      [job.data.jobId]
    ).catch(() => {});
  });

  return worker;
}
