import { FastifyInstance } from "fastify";
import { z } from "zod";
import { linkService } from "../services/link.service";

const createSchema = z.object({
  original_url: z.string().url(),
  slug: z.string().min(3).max(20).optional(),
  title: z.string().max(512).optional(),
  expires_at: z.string().datetime().optional(),
});

const updateSchema = z.object({
  original_url: z.string().url().optional(),
  title: z.string().max(512).optional(),
  active: z.boolean().optional(),
  expires_at: z.string().datetime().nullable().optional(),
});

const listSchema = z.object({
  page: z.coerce.number().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  search: z.string().optional(),
  sortBy: z.enum(["created_at", "clicks"]).optional(),
});

export async function linkController(app: FastifyInstance): Promise<void> {
  // List links
  app.get("/links", { preHandler: [app.authenticate] }, async (request, reply) => {
    const query = listSchema.safeParse(request.query);
    if (!query.success) {
      return reply.status(400).send({ error: "Invalid query", details: query.error.flatten() });
    }
    const result = await linkService.list(request.user.sub, query.data);
    return reply.send(result);
  });

  // Create link
  app.post("/links", { preHandler: [app.authenticate] }, async (request, reply) => {
    const body = createSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Validation error", details: body.error.flatten() });
    }

    try {
      const link = await linkService.create(request.user.sub, body.data);
      return reply.status(201).send(link);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create link";
      const statusCode = message.includes("already exists") || message.includes("unique") ? 409 : 400;
      return reply.status(statusCode).send({ error: message });
    }
  });

  // Update link
  app.patch("/links/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = updateSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Validation error", details: body.error.flatten() });
    }

    try {
      const link = await linkService.update(id, request.user.sub, body.data);
      if (!link) return reply.status(404).send({ error: "Link not found" });
      return reply.send(link);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update link";
      return reply.status(400).send({ error: message });
    }
  });

  // Delete link
  app.delete("/links/:id", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = await linkService.remove(id, request.user.sub);
    if (!deleted) return reply.status(404).send({ error: "Link not found" });
    return reply.status(204).send();
  });

  // Stats
  app.get("/links/stats", { preHandler: [app.authenticate] }, async (request, reply) => {
    const stats = await linkService.getStats(request.user.sub);
    return reply.send(stats);
  });
}
