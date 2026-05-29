import { generateSlug, isValidSlug, sanitizeSlug } from "../../utils/slug";

const VALID_ALPHABET = /^[abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/;

describe("generateSlug", () => {
  it("generates slug with default length of 7", () => {
    expect(generateSlug()).toHaveLength(7);
  });

  it("generates slug with custom length", () => {
    expect(generateSlug(8)).toHaveLength(8);
  });

  it("uses only valid alphabet characters", () => {
    for (let i = 0; i < 50; i++) {
      expect(generateSlug()).toMatch(VALID_ALPHABET);
    }
  });

  it("does not include ambiguous characters (0, O, I, l)", () => {
    for (let i = 0; i < 100; i++) {
      const slug = generateSlug();
      expect(slug).not.toMatch(/[0OIl]/);
    }
  });

  it("generates unique slugs", () => {
    const slugs = new Set(Array.from({ length: 1000 }, () => generateSlug()));
    expect(slugs.size).toBe(1000);
  });
});

describe("isValidSlug", () => {
  it("accepts alphanumeric slug with 3 chars", () => {
    expect(isValidSlug("abc")).toBe(true);
  });

  it("accepts alphanumeric slug with 20 chars", () => {
    expect(isValidSlug("a".repeat(20))).toBe(true);
  });

  it("accepts slug with hyphens in middle", () => {
    expect(isValidSlug("my-short-link")).toBe(true);
  });

  it("accepts mixed case slug", () => {
    expect(isValidSlug("MyLink123")).toBe(true);
  });

  it("rejects slug shorter than 3 chars", () => {
    expect(isValidSlug("ab")).toBe(false);
  });

  it("rejects slug longer than 20 chars", () => {
    expect(isValidSlug("a".repeat(21))).toBe(false);
  });

  it("rejects slug with spaces", () => {
    expect(isValidSlug("my link")).toBe(false);
  });

  it("rejects slug with special characters", () => {
    expect(isValidSlug("my_link!")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidSlug("")).toBe(false);
  });
});

describe("sanitizeSlug", () => {
  it("converts to lowercase", () => {
    expect(sanitizeSlug("MySlug")).toBe("myslug");
  });

  it("removes spaces and special characters", () => {
    expect(sanitizeSlug("my slug!@#")).toBe("myslug");
  });

  it("truncates to 20 characters", () => {
    expect(sanitizeSlug("a".repeat(30))).toHaveLength(20);
  });

  it("preserves hyphens", () => {
    expect(sanitizeSlug("my-link")).toBe("my-link");
  });

  it("removes underscores", () => {
    expect(sanitizeSlug("my_link")).toBe("mylink");
  });
});
