import Fastify, { FastifyInstance } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fastifyCors from "@fastify/cors";
import fastifyMultipart from "@fastify/multipart";
import fastifyRateLimit from "@fastify/rate-limit";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { FastifyAdapter as BullBoardAdapter } from "@bull-board/fastify";
import { env } from "./config/env";
import { getPool } from "./config/database";
import { getRedis } from "./config/redis";
import { batchQueue } from "./queues/batch.queue";
import { authenticate } from "./middleware/auth.middleware";
import { authController } from "./controllers/auth.controller";
import { linkController } from "./controllers/link.controller";
import { batchController } from "./controllers/batch.controller";
import { redirectController } from "./controllers/redirect.controller";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: env.NODE_ENV === "production" ? "info" : "debug",
      transport: env.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
    },
    trustProxy: true,
  });

  // ---- plugins ----
  await app.register(fastifyCors, {
    origin: env.NODE_ENV === "development" ? true : [env.BASE_URL],
    credentials: true,
  });

  await app.register(fastifyJwt, { secret: env.JWT_SECRET });

  await app.register(fastifyMultipart, {
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });

  await app.register(fastifyRateLimit, {
    global: true,
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_SECONDS * 1000,
    skipOnError: true,
    keyGenerator: (req) => req.ip,
  });

  app.decorate("authenticate", authenticate);

  // ---- Bull Board at /queues ----
  // setBasePath must be called before createBullBoard
  const boardAdapter = new BullBoardAdapter();
  boardAdapter.setBasePath("/queues");
  createBullBoard({ queues: [new BullMQAdapter(batchQueue)], serverAdapter: boardAdapter });

  await app.register(boardAdapter.registerPlugin(), { prefix: "/queues" });

  // ---- routes ----
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "ziplink-api",
  }));

  await app.register(
    async (api) => {
      await api.register(authController);
      await api.register(linkController);
      await api.register(batchController);
    },
    { prefix: "/api" }
  );

  // Slug redirect at root — nginx proxies everything here first, falls back to SPA on 404
  await app.register(redirectController);

  return app;
}

async function start(): Promise<void> {
  const app = await buildApp();

  try {
    await getPool().query("SELECT 1");
    await getRedis().ping();
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    app.log.info(`ZipLink API on port ${env.PORT} — queue board at /queues`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, shutting down gracefully...`);
  await getPool().end();
  getRedis().disconnect();
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

start();
