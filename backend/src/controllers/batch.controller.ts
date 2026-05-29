import { FastifyInstance } from "fastify";
import { batchService } from "../services/batch.service";

export async function batchController(app: FastifyInstance): Promise<void> {
  // Submit batch import
  app.post("/batch", { preHandler: [app.authenticate] }, async (request, reply) => {
    const data = await request.file();

    if (!data) {
      return reply.status(400).send({ error: "No file uploaded" });
    }

    const allowedTypes = ["text/csv", "application/json", "application/octet-stream"];
    const filename = data.filename.toLowerCase();

    if (!allowedTypes.includes(data.mimetype) && !filename.endsWith(".csv") && !filename.endsWith(".json")) {
      return reply.status(400).send({ error: "Only CSV or JSON files are accepted" });
    }

    const buffer = await data.toBuffer();

    if (buffer.length > 5 * 1024 * 1024) {
      return reply.status(413).send({ error: "File too large (max 5MB)" });
    }

    try {
      const mimetype = filename.endsWith(".json") ? "application/json" : "text/csv";
      const job = await batchService.submit(request.user.sub, buffer, mimetype);
      return reply.status(202).send({
        message: "Batch import accepted and queued",
        job_id: job.id,
        total: job.total,
        status_url: `/api/batch/${job.id}`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Batch submission failed";
      return reply.status(400).send({ error: message });
    }
  });

  // Get job status
  app.get("/batch/:jobId", { preHandler: [app.authenticate] }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string };
    const job = await batchService.getStatus(jobId, request.user.sub);
    if (!job) return reply.status(404).send({ error: "Job not found" });
    return reply.send(job);
  });

  // List jobs
  app.get("/batch", { preHandler: [app.authenticate] }, async (request, reply) => {
    const jobs = await batchService.listJobs(request.user.sub);
    return reply.send(jobs);
  });
}
