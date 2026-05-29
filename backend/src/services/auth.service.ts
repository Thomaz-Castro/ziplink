import bcrypt from "bcryptjs";
import { query, withTransaction } from "../config/database";
import { env } from "../config/env";
import { User } from "../types";

export class AuthService {
  async register(email: string, password: string): Promise<Omit<User, "password_hash">> {
    const existing = await query<User>(
      `SELECT id FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (existing.rows[0]) {
      throw new Error("Email already registered");
    }

    const hash = await bcrypt.hash(password, env.BCRYPT_ROUNDS);

    const result = await withTransaction(async (client) => {
      return client.query<User>(
        `INSERT INTO users (email, password_hash)
         VALUES ($1, $2)
         RETURNING id, email, created_at, updated_at`,
        [email.toLowerCase(), hash]
      );
    });

    const { password_hash: _, ...user } = result.rows[0];
    return user as Omit<User, "password_hash">;
  }

  async login(email: string, password: string): Promise<Omit<User, "password_hash">> {
    const result = await query<User>(
      `SELECT * FROM users WHERE email = $1`,
      [email.toLowerCase()]
    );

    const user = result.rows[0];
    if (!user) throw new Error("Invalid credentials");

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) throw new Error("Invalid credentials");

    const { password_hash: _, ...safe } = user;
    return safe as Omit<User, "password_hash">;
  }

  async findById(id: string): Promise<Omit<User, "password_hash"> | null> {
    const result = await query<User>(
      `SELECT id, email, created_at, updated_at FROM users WHERE id = $1`,
      [id]
    );
    return (result.rows[0] as Omit<User, "password_hash">) ?? null;
  }
}

export const authService = new AuthService();
