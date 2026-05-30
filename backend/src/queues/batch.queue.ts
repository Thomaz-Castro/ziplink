import { Queue } from "bullmq";
import { getRedis } from "../config/redis";

export const BATCH_QUEUE_NAME = "batch-import";

export const batchQueue = new Queue(BATCH_QUEUE_NAME, {
  connection: getRedis() as any,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  },
});
