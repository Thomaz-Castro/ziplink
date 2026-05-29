import { PoolClient } from "pg";
import { query, withTransaction } from "../config/database";
import { getCachedUrl, invalidateCachedUrl, setCachedUrl } from "../config/redis";
import { Link, CreateLinkInput, UpdateLinkInput, PaginationQuery } from "../types";
import { generateSlug, isValidSlug } from "../utils/slug";
import { isValidUrl } from "../utils/url";

const MAX_SLUG_RETRIES = 5;

// Slugs that collide with nginx/SPA routes or well-known paths
const RESERVED_SLUGS = new Set([
  "api", "health", "queues", "favicon.ico", "robots.txt", "sitemap.xml",
  "login", "register", "links", "batch", "stats", "app", "assets", "static",
]);

export class LinkService {
  async create(userId: string, input: CreateLinkInput): Promise<Link> {
    if (!isValidUrl(input.original_url)) {
      throw new Error("Invalid URL format");
    }

    if (input.slug && !isValidSlug(input.slug)) {
      throw new Error("Invalid slug format: 3-20 alphanumeric chars or hyphens");
    }

    if (input.slug && RESERVED_SLUGS.has(input.slug.toLowerCase())) {
      throw new Error(`Slug '${input.slug}' is reserved`);
    }

    return withTransaction(async (client) => {
      const slug = input.slug ?? (await this.generateUniqueSlug(client));
      const result = await client.query<Link>(
        `INSERT INTO links (user_id, slug, original_url, title, expires_at)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [userId, slug, input.original_url, input.title ?? null, input.expires_at ?? null]
      );
      return result.rows[0];
    });
  }

  async findBySlug(slug: string): Promise<Link | null> {
    const cachedUrl = await getCachedUrl(slug);
    if (cachedUrl) {
      // Return a partial link object for redirect purposes (cache hit)
      return { slug, original_url: cachedUrl } as Link;
    }

    const result = await query<Link>(
      `SELECT * FROM links WHERE slug = $1 AND active = TRUE
       AND (expires_at IS NULL OR expires_at > NOW())`,
      [slug]
    );

    if (!result.rows[0]) return null;

    const link = result.rows[0];
    // Populate cache asynchronously — do not block redirect
    setCachedUrl(slug, link.original_url).catch(() => {});
    return link;
  }

  async recordClick(linkId: string, meta: { referer?: string; userAgent?: string; ipHash?: string }): Promise<void> {
    // Fire-and-forget click increment + analytics insertion
    query(
      `UPDATE links SET clicks = clicks + 1 WHERE id = $1`,
      [linkId]
    ).catch(() => {});

    query(
      `INSERT INTO link_clicks (link_id, referer, user_agent, ip_hash)
       VALUES ($1, $2, $3, $4)`,
      [linkId, meta.referer ?? null, meta.userAgent ?? null, meta.ipHash ?? null]
    ).catch(() => {});
  }

  async list(userId: string, opts: PaginationQuery) {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(100, opts.limit ?? 20);
    const offset = (page - 1) * limit;

    const search = opts.search ? `%${opts.search}%` : null;
    const activeFilter = opts.active !== undefined ? opts.active : null;
    const orderBy = opts.sortBy === "clicks" ? "clicks DESC, created_at DESC" : "created_at DESC";

    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) FROM links WHERE user_id = $1
       AND ($2::TEXT IS NULL OR original_url ILIKE $2 OR slug ILIKE $2 OR title ILIKE $2)
       AND ($3::BOOLEAN IS NULL OR active = $3)`,
      [userId, search, activeFilter]
    );

    const total = parseInt(countResult.rows[0].count, 10);

    const rows = await query<Link>(
      `SELECT * FROM links WHERE user_id = $1
       AND ($2::TEXT IS NULL OR original_url ILIKE $2 OR slug ILIKE $2 OR title ILIKE $2)
       AND ($3::BOOLEAN IS NULL OR active = $3)
       ORDER BY ${orderBy}
       LIMIT $4 OFFSET $5`,
      [userId, search, activeFilter, limit, offset]
    );

    return { data: rows.rows, total, page, limit };
  }

  async update(id: string, userId: string, input: UpdateLinkInput): Promise<Link | null> {
    if (input.original_url && !isValidUrl(input.original_url)) {
      throw new Error("Invalid URL format");
    }

    return withTransaction(async (client) => {
      const existing = await client.query<Link>(
        `SELECT * FROM links WHERE id = $1 AND user_id = $2 FOR UPDATE`,
        [id, userId]
      );

      if (!existing.rows[0]) return null;

      const current = existing.rows[0];

      const result = await client.query<Link>(
        `UPDATE links SET
          original_url = $1,
          title        = $2,
          active       = $3,
          expires_at   = $4
         WHERE id = $5 AND user_id = $6
         RETURNING *`,
        [
          input.original_url ?? current.original_url,
          input.title !== undefined ? input.title : current.title,
          input.active !== undefined ? input.active : current.active,
          input.expires_at !== undefined ? input.expires_at : current.expires_at,
          id,
          userId,
        ]
      );

      const updated = result.rows[0];
      await invalidateCachedUrl(updated.slug);
      return updated;
    });
  }

  async remove(id: string, userId: string): Promise<boolean> {
    return withTransaction(async (client) => {
      const found = await client.query<Link>(
        `SELECT slug FROM links WHERE id = $1 AND user_id = $2`,
        [id, userId]
      );

      if (!found.rows[0]) return false;

      await client.query(`DELETE FROM links WHERE id = $1 AND user_id = $2`, [id, userId]);
      await invalidateCachedUrl(found.rows[0].slug);
      return true;
    });
  }

  async getStats(userId: string) {
    const result = await query<{
      total_links: string;
      active_links: string;
      total_clicks: string;
    }>(
      `SELECT
        COUNT(*) AS total_links,
        COUNT(*) FILTER (WHERE active = TRUE) AS active_links,
        COALESCE(SUM(clicks), 0) AS total_clicks
       FROM links WHERE user_id = $1`,
      [userId]
    );
    return result.rows[0];
  }

  // --- private helpers ---

  private async generateUniqueSlug(client: PoolClient): Promise<string> {
    for (let i = 0; i < MAX_SLUG_RETRIES; i++) {
      const candidate = generateSlug(i < 3 ? 7 : 8); // grow length after 3 collisions
      const exists = await client.query(
        `SELECT 1 FROM links WHERE slug = $1`,
        [candidate]
      );
      if (!exists.rows[0]) return candidate;
    }
    throw new Error("Slug generation exhausted retries — try again");
  }
}

export const linkService = new LinkService();
