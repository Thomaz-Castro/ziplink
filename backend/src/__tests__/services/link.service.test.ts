import { LinkService } from "../../services/link.service";
import * as db from "../../config/database";
import * as redis from "../../config/redis";

jest.mock("../../config/database");
jest.mock("../../config/redis");
jest.mock("../../config/env", () => ({ env: { BASE_URL: "http://localhost" } }));

const mockQuery = db.query as jest.Mock;
const mockWithTransaction = db.withTransaction as jest.Mock;
const mockGetCachedUrl = redis.getCachedUrl as jest.Mock;
const mockSetCachedUrl = redis.setCachedUrl as jest.Mock;
const mockInvalidateCachedUrl = redis.invalidateCachedUrl as jest.Mock;

const makeLink = (overrides = {}) => ({
  id: "link-1",
  user_id: "user-1",
  slug: "abc1234",
  original_url: "https://example.com",
  title: null,
  clicks: 0,
  active: true,
  expires_at: null,
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const makeClient = () => {
  const client = { query: jest.fn() };
  mockWithTransaction.mockImplementation((fn: Function) => fn(client));
  return client;
};

describe("LinkService.create", () => {
  let service: LinkService;

  beforeEach(() => {
    service = new LinkService();
  });

  it("creates a link with auto-generated slug", async () => {
    const link = makeLink();
    const client = makeClient();
    client.query
      .mockResolvedValueOnce({ rows: [] })        // slug availability check
      .mockResolvedValueOnce({ rows: [link] });    // INSERT

    const result = await service.create("user-1", { original_url: "https://example.com" });

    expect(result.original_url).toBe("https://example.com");
    expect(result.slug).toBeDefined();
  });

  it("creates a link with custom slug", async () => {
    const link = makeLink({ slug: "my-link" });
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [link] }); // INSERT

    const result = await service.create("user-1", {
      original_url: "https://example.com",
      slug: "my-link",
    });

    expect(result.slug).toBe("my-link");
  });

  it("throws on invalid URL", async () => {
    await expect(
      service.create("user-1", { original_url: "not-a-url" })
    ).rejects.toThrow("Invalid URL format");
    expect(mockWithTransaction).not.toHaveBeenCalled();
  });

  it("throws on invalid slug format", async () => {
    await expect(
      service.create("user-1", { original_url: "https://example.com", slug: "x" })
    ).rejects.toThrow("Invalid slug format");
  });

  it("throws on reserved slug", async () => {
    await expect(
      service.create("user-1", { original_url: "https://example.com", slug: "api" })
    ).rejects.toThrow("reserved");
  });

  it("throws when slug generation exhausts retries", async () => {
    const client = makeClient();
    // All 5 attempts find an existing slug
    client.query.mockResolvedValue({ rows: [{ "?column?": 1 }] });

    await expect(
      service.create("user-1", { original_url: "https://example.com" })
    ).rejects.toThrow("exhausted retries");
  });
});

describe("LinkService.findBySlug", () => {
  let service: LinkService;

  beforeEach(() => {
    service = new LinkService();
    mockSetCachedUrl.mockResolvedValue(undefined);
  });

  it("returns link from Redis cache when available", async () => {
    mockGetCachedUrl.mockResolvedValueOnce("https://cached.com");

    const result = await service.findBySlug("abc1234");

    expect(result?.original_url).toBe("https://cached.com");
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("falls back to DB on cache miss and populates cache", async () => {
    mockGetCachedUrl.mockResolvedValueOnce(null);
    const link = makeLink();
    mockQuery.mockResolvedValueOnce({ rows: [link] });

    const result = await service.findBySlug("abc1234");

    expect(result?.original_url).toBe("https://example.com");
    expect(mockSetCachedUrl).toHaveBeenCalledWith("abc1234", "https://example.com");
  });

  it("returns null when slug not found in DB", async () => {
    mockGetCachedUrl.mockResolvedValueOnce(null);
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await service.findBySlug("notfound");

    expect(result).toBeNull();
  });
});

describe("LinkService.update", () => {
  let service: LinkService;

  beforeEach(() => {
    service = new LinkService();
    mockInvalidateCachedUrl.mockResolvedValue(undefined);
  });

  it("updates link and invalidates cache", async () => {
    const original = makeLink();
    const updated = makeLink({ title: "New title", active: false });
    const client = makeClient();
    client.query
      .mockResolvedValueOnce({ rows: [original] })  // SELECT FOR UPDATE
      .mockResolvedValueOnce({ rows: [updated] });   // UPDATE

    const result = await service.update("link-1", "user-1", { title: "New title", active: false });

    expect(result?.title).toBe("New title");
    expect(mockInvalidateCachedUrl).toHaveBeenCalledWith(updated.slug);
  });

  it("returns null when link does not belong to user", async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [] }); // SELECT FOR UPDATE — not found

    const result = await service.update("link-1", "wrong-user", { active: false });

    expect(result).toBeNull();
  });

  it("throws on invalid URL in update", async () => {
    await expect(
      service.update("link-1", "user-1", { original_url: "bad-url" })
    ).rejects.toThrow("Invalid URL format");
    expect(mockWithTransaction).not.toHaveBeenCalled();
  });
});

describe("LinkService.remove", () => {
  let service: LinkService;

  beforeEach(() => {
    service = new LinkService();
    mockInvalidateCachedUrl.mockResolvedValue(undefined);
  });

  it("deletes link and invalidates cache, returns true", async () => {
    const client = makeClient();
    client.query
      .mockResolvedValueOnce({ rows: [{ slug: "abc1234" }] }) // SELECT slug
      .mockResolvedValueOnce({ rows: [] });                   // DELETE

    const result = await service.remove("link-1", "user-1");

    expect(result).toBe(true);
    expect(mockInvalidateCachedUrl).toHaveBeenCalledWith("abc1234");
  });

  it("returns false when link not found", async () => {
    const client = makeClient();
    client.query.mockResolvedValueOnce({ rows: [] }); // SELECT slug — not found

    const result = await service.remove("ghost", "user-1");

    expect(result).toBe(false);
    expect(mockInvalidateCachedUrl).not.toHaveBeenCalled();
  });
});

describe("LinkService.getStats", () => {
  let service: LinkService;

  beforeEach(() => {
    service = new LinkService();
  });

  it("returns parsed stats for user", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ total_links: "10", active_links: "7", total_clicks: "42" }],
    });

    const stats = await service.getStats("user-1");

    expect(stats.total_links).toBe("10");
    expect(stats.active_links).toBe("7");
    expect(stats.total_clicks).toBe("42");
  });
});

describe("LinkService.list", () => {
  let service: LinkService;

  beforeEach(() => {
    service = new LinkService();
  });

  it("returns paginated links with total count", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: "5" }] })
      .mockResolvedValueOnce({ rows: [makeLink(), makeLink({ id: "link-2" })] });

    const result = await service.list("user-1", { page: 1, limit: 20 });

    expect(result.total).toBe(5);
    expect(result.data).toHaveLength(2);
    expect(result.page).toBe(1);
  });

  it("clamps limit to 100", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [] });

    await service.list("user-1", { page: 1, limit: 999 });

    expect(mockQuery).toHaveBeenNthCalledWith(
      2,
      expect.any(String),
      expect.arrayContaining([100])
    );
  });

  it("defaults page to 1 when not provided", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ count: "0" }] })
      .mockResolvedValueOnce({ rows: [] });

    const result = await service.list("user-1", {});

    expect(result.page).toBe(1);
  });
});

describe("LinkService.recordClick", () => {
  let service: LinkService;

  beforeEach(() => {
    service = new LinkService();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  it("fires click increment and analytics insert without blocking", async () => {
    await service.recordClick("link-1", {
      referer: "https://referrer.com",
      userAgent: "Mozilla/5.0",
      ipHash: "abc123",
    });

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE links SET clicks"),
      ["link-1"]
    );
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO link_clicks"),
      ["link-1", "https://referrer.com", "Mozilla/5.0", "abc123"]
    );
  });
});
