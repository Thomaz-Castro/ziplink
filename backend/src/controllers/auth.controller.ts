import { FastifyInstance } from "fastify";
import { z } from "zod";
import { authService } from "../services/auth.service";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function authController(app: FastifyInstance): Promise<void> {
  app.post("/auth/register", async (request, reply) => {
    const body = registerSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Validation error", details: body.error.flatten() });
    }

    try {
      const user = await authService.register(body.data.email, body.data.password);
      const token = app.jwt.sign(
        { sub: user.id, email: user.email } as any,
        { expiresIn: "7d" }
      );
      return reply.status(201).send({ user, token });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Registration failed";
      const statusCode = message.includes("already registered") ? 409 : 500;
      return reply.status(statusCode).send({ error: message });
    }
  });

  app.post("/auth/login", async (request, reply) => {
    const body = loginSchema.safeParse(request.body);
    if (!body.success) {
      return reply.status(400).send({ error: "Validation error", details: body.error.flatten() });
    }

    try {
      const user = await authService.login(body.data.email, body.data.password);
      const token = app.jwt.sign(
        { sub: user.id, email: user.email } as any,
        { expiresIn: "7d" }
      );
      return reply.send({ user, token });
    } catch {
      return reply.status(401).send({ error: "Invalid credentials" });
    }
  });

  app.get("/auth/me", { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = await authService.findById(request.user.sub);
    if (!user) return reply.status(404).send({ error: "User not found" });
    return reply.send({ user });
  });
}
