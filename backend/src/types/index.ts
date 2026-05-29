export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
}

export interface Link {
  id: string;
  user_id: string;
  slug: string;
  original_url: string;
  title: string | null;
  clicks: number;
  active: boolean;
  expires_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface BatchJob {
  id: string;
  user_id: string;
  status: "pending" | "processing" | "completed" | "failed";
  total: number;
  processed: number;
  success_count: number;
  failure_count: number;
  results: BatchResult[];
  created_at: Date;
  updated_at: Date;
}

export interface BatchResult {
  line: number;
  url: string;
  slug?: string;
  short_url?: string;
  status: "success" | "error";
  error?: string;
}

export interface CreateLinkInput {
  original_url: string;
  slug?: string;
  title?: string;
  expires_at?: string;
}

export interface UpdateLinkInput {
  original_url?: string;
  title?: string;
  active?: boolean;
  expires_at?: string | null;
}

export interface PaginationQuery {
  page?: number;
  limit?: number;
  search?: string;
  sortBy?: "created_at" | "clicks";
}

export interface JwtPayload {
  sub: string;
  email: string;
  iat: number;
  exp: number;
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

declare module "fastify" {
  interface FastifyInstance {
    authenticate: (
      request: import("fastify").FastifyRequest,
      reply: import("fastify").FastifyReply
    ) => Promise<void>;
  }
}
