import { parse as parseCsv } from "csv-parse/sync";
import { query, withTransaction } from "../config/database";
import { BatchJob } from "../types";
import { batchQueue } from "../queues/batch.queue";

interface RawEntry {
  url: string;
  slug?: string;
  title?: string;
}

export class BatchService {
  async submit(userId: string, fileBuffer: Buffer, mimetype: string): Promise<BatchJob> {
    const entries = this.parseFile(fileBuffer, mimetype);

    if (entries.length === 0) throw new Error("File contains no valid entries");
    if (entries.length > 2000) throw new Error("Maximum 2,000 URLs per batch");

    return withTransaction(async (client) => {
      const result = await client.query<BatchJob>(
        `INSERT INTO batch_jobs (user_id, total)
         VALUES ($1, $2)
         RETURNING *`,
        [userId, entries.length]
      );

      const job = result.rows[0];

      await batchQueue.add(
        "process-batch",
        { jobId: job.id, userId, entries },
        {
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
          removeOnComplete: { age: 86400 },
          removeOnFail: { age: 86400 * 7 },
        }
      );

      return job;
    });
  }

  async getStatus(jobId: string, userId: string): Promise<BatchJob | null> {
    const result = await query<BatchJob>(
      `SELECT * FROM batch_jobs WHERE id = $1 AND user_id = $2`,
      [jobId, userId]
    );
    return result.rows[0] ?? null;
  }

  async listJobs(userId: string) {
    const result = await query<BatchJob>(
      `SELECT id, status, total, processed, success_count, failure_count, created_at, updated_at
       FROM batch_jobs WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );
    return result.rows;
  }

  private parseFile(buffer: Buffer, mimetype: string): RawEntry[] {
    const content = buffer.toString("utf-8");

    if (mimetype === "application/json" || content.trimStart().startsWith("[")) {
      const parsed = JSON.parse(content);
      if (!Array.isArray(parsed)) throw new Error("JSON must be an array");
      return parsed.map((item: Record<string, string>, i: number) => {
        if (!item.url) throw new Error(`Entry at index ${i} missing 'url' field`);
        return { url: item.url.trim(), slug: item.slug?.trim(), title: item.title?.trim() };
      });
    }

    // CSV: url,slug,title  (slug and title are optional columns)
    const records = parseCsv(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as Record<string, string>[];

    return records.map((row, i) => {
      const url = row.url || row.URL || row.Url;
      if (!url) throw new Error(`CSV row ${i + 1} missing 'url' column`);
      return { url, slug: row.slug || row.custom_slug, title: row.title };
    });
  }
}

export const batchService = new BatchService();
