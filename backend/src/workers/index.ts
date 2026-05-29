import { env } from "../config/env";
import { createBatchWorker } from "./batch.worker";

console.log("Starting ZipLink workers...");
console.log(`Environment: ${env.NODE_ENV}`);
console.log(`Worker concurrency: ${env.WORKER_CONCURRENCY}`);

const batchWorker = createBatchWorker();

batchWorker.on("ready", () => {
  console.log("Batch worker ready and listening for jobs");
});

batchWorker.on("completed", (job) => {
  console.log(`Batch job ${job.id} completed:`, job.returnvalue);
});

batchWorker.on("error", (err) => {
  console.error("Worker error:", err);
});

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down workers gracefully...`);
  await batchWorker.close();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
