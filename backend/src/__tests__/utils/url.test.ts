import { isValidUrl, normalizeUrl } from "../../utils/url";

describe("isValidUrl", () => {
  it("accepts valid http URL", () => {
    expect(isValidUrl("http://example.com")).toBe(true);
  });

  it("accepts valid https URL", () => {
    expect(isValidUrl("https://example.com/path?q=1")).toBe(true);
  });

  it("accepts URL with port", () => {
    expect(isValidUrl("https://localhost:3000/api")).toBe(true);
  });

  it("rejects ftp protocol", () => {
    expect(isValidUrl("ftp://files.example.com")).toBe(false);
  });

  it("rejects string without protocol", () => {
    expect(isValidUrl("example.com")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(isValidUrl("")).toBe(false);
  });

  it("rejects plain text", () => {
    expect(isValidUrl("not a url")).toBe(false);
  });

  it("rejects javascript: protocol", () => {
    expect(isValidUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("normalizeUrl", () => {
  it("removes trailing slash from path", () => {
    expect(normalizeUrl("https://example.com/path/")).toBe("https://example.com/path");
  });

  it("preserves root slash", () => {
    expect(normalizeUrl("https://example.com/")).toBe("https://example.com/");
  });

  it("preserves query string", () => {
    expect(normalizeUrl("https://example.com/path?foo=bar")).toBe(
      "https://example.com/path?foo=bar"
    );
  });

  it("preserves URL without trailing slash", () => {
    expect(normalizeUrl("https://example.com/path")).toBe("https://example.com/path");
  });
});
