import Redis from "ioredis";
import { env } from "./env";

let redisClient: Redis;

export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      lazyConnect: false,
    });

    redisClient.on("error", (err) => {
      console.error("Redis client error:", err.message);
    });
  }
  return redisClient;
}

export const CACHE_TTL_SECONDS = 3600; // 1 hour

export async function getCachedUrl(slug: string): Promise<string | null> {
  return getRedis().get(`slug:${slug}`);
}

export async function setCachedUrl(slug: string, url: string): Promise<void> {
  await getRedis().setex(`slug:${slug}`, CACHE_TTL_SECONDS, url);
}

export async function invalidateCachedUrl(slug: string): Promise<void> {
  await getRedis().del(`slug:${slug}`);
}
