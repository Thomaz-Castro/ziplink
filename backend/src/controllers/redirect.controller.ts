import { FastifyInstance } from "fastify";
import crypto from "crypto";
import { linkService } from "../services/link.service";

export async function redirectController(app: FastifyInstance): Promise<void> {
  app.get("/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };

    const link = await linkService.findBySlug(slug);
    if (!link) {
      return reply.status(404).send({ error: "Link not found or expired" });
    }

    if (link.id) {
      const ipHash = crypto.createHash("sha256").update(request.ip).digest("hex").slice(0, 16);
      linkService.recordClick(link.id, {
        referer: request.headers.referer,
        userAgent: request.headers["user-agent"],
        ipHash,
      });
    }

    return reply.status(302).redirect(link.original_url);
  });
}
