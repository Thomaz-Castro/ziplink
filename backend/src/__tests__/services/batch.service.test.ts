import { BatchService } from "../../services/batch.service";
import * as db from "../../config/database";
import { batchQueue } from "../../queues/batch.queue";

jest.mock("../../config/database");
jest.mock("../../queues/batch.queue", () => ({
  batchQueue: { add: jest.fn().mockResolvedValue(undefined) },
}));
jest.mock("../../config/env", () => ({ env: { BASE_URL: "http://localhost" } }));

const mockWithTransaction = db.withTransaction as jest.Mock;
const mockQuery = db.query as jest.Mock;
const mockQueueAdd = batchQueue.add as jest.Mock;

const makeJob = (overrides = {}) => ({
  id: "job-1",
  user_id: "user-1",
  status: "pending",
  total: 2,
  processed: 0,
  success_count: 0,
  failure_count: 0,
  results: [],
  created_at: new Date(),
  updated_at: new Date(),
  ...overrides,
});

const csvBuffer = (content: string) => Buffer.from(content, "utf-8");

describe("BatchService — parseFile (via submit)", () => {
  let service: BatchService;

  beforeEach(() => {
    service = new BatchService();
  });

  it("parses valid CSV and submits job", async () => {
    const csv = "url,slug,title\nhttps://a.com,slug-a,Title A\nhttps://b.com,,";
    const job = makeJob({ total: 2 });
    const client = { query: jest.fn().mockResolvedValue({ rows: [job] }) };
    mockWithTransaction.mockImplementation((fn: Function) => fn(client));

    const result = await service.submit("user-1", csvBuffer(csv), "text/csv");

    expect(result.total).toBe(2);
    expect(mockQueueAdd).toHaveBeenCalledWith(
      "process-batch",
      expect.objectContaining({
        jobId: "job-1",
        entries: expect.arrayContaining([
          expect.objectContaining({ url: "https://a.com", slug: "slug-a" }),
          expect.objectContaining({ url: "https://b.com" }),
        ]),
      }),
      expect.any(Object)
    );
  });

  it("parses valid JSON array and submits job", async () => {
    const json = JSON.stringify([
      { url: "https://a.com", slug: "s1", title: "A" },
      { url: "https://b.com" },
    ]);
    const job = makeJob({ total: 2 });
    const client = { query: jest.fn().mockResolvedValue({ rows: [job] }) };
    mockWithTransaction.mockImplementation((fn: Function) => fn(client));

    const result = await service.submit("user-1", Buffer.from(json), "application/json");

    expect(result.total).toBe(2);
  });

  it("throws when CSV has no rows", async () => {
    const csv = "url,slug,title\n";

    await expect(
      service.submit("user-1", csvBuffer(csv), "text/csv")
    ).rejects.toThrow("no valid entries");
  });

  it("throws when JSON is not an array", async () => {
    const json = JSON.stringify({ url: "https://a.com" });

    await expect(
      service.submit("user-1", Buffer.from(json), "application/json")
    ).rejects.toThrow("array");
  });

  it("throws when JSON entry is missing url field", async () => {
    const json = JSON.stringify([{ slug: "s1" }]);

    await expect(
      service.submit("user-1", Buffer.from(json), "application/json")
    ).rejects.toThrow("missing 'url'");
  });

  it("throws when CSV row is missing url column", async () => {
    const csv = "title\nsome title\n";

    await expect(
      service.submit("user-1", csvBuffer(csv), "text/csv")
    ).rejects.toThrow("missing 'url'");
  });

  it("throws when entries exceed 2000 limit", async () => {
    const rows = Array.from({ length: 2001 }, (_, i) => `https://example.com/${i},,`).join("\n");
    const csv = `url,slug,title\n${rows}`;

    await expect(
      service.submit("user-1", csvBuffer(csv), "text/csv")
    ).rejects.toThrow("Maximum 2,000 URLs");
  });

  it("accepts CSV with alternative column name (URL uppercase)", async () => {
    const csv = "URL,slug\nhttps://example.com,my-slug\n";
    const job = makeJob({ total: 1 });
    const client = { query: jest.fn().mockResolvedValue({ rows: [job] }) };
    mockWithTransaction.mockImplementation((fn: Function) => fn(client));

    const result = await service.submit("user-1", csvBuffer(csv), "text/csv");

    expect(result.total).toBe(1);
  });

  it("accepts CSV with custom_slug column name", async () => {
    const csv = "url,custom_slug\nhttps://example.com,my-slug\n";
    const job = makeJob({ total: 1 });
    const client = { query: jest.fn().mockResolvedValue({ rows: [job] }) };
    mockWithTransaction.mockImplementation((fn: Function) => fn(client));

    const result = await service.submit("user-1", csvBuffer(csv), "text/csv");
    expect(result.total).toBe(1);
  });
});

describe("BatchService.getStatus", () => {
  let service: BatchService;

  beforeEach(() => {
    service = new BatchService();
  });

  it("returns job when found", async () => {
    const job = makeJob({ status: "completed" });
    mockQuery.mockResolvedValueOnce({ rows: [job] });

    const result = await service.getStatus("job-1", "user-1");

    expect(result?.status).toBe("completed");
  });

  it("returns null when job not found", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await service.getStatus("ghost", "user-1");

    expect(result).toBeNull();
  });

  it("does not return job belonging to another user", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await service.getStatus("job-1", "other-user");

    expect(result).toBeNull();
    expect(mockQuery).toHaveBeenCalledWith(
      expect.any(String),
      ["job-1", "other-user"]
    );
  });
});

describe("BatchService.listJobs", () => {
  let service: BatchService;

  beforeEach(() => {
    service = new BatchService();
  });

  it("returns list of jobs for user", async () => {
    const jobs = [makeJob(), makeJob({ id: "job-2" })];
    mockQuery.mockResolvedValueOnce({ rows: jobs });

    const result = await service.listJobs("user-1");

    expect(result).toHaveLength(2);
  });

  it("returns empty array when user has no jobs", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await service.listJobs("user-1");

    expect(result).toEqual([]);
  });
});
