import { AuthService } from "../../services/auth.service";
import * as db from "../../config/database";
import bcrypt from "bcryptjs";

jest.mock("../../config/database");
jest.mock("bcryptjs");
jest.mock("../../config/env", () => ({ env: { BCRYPT_ROUNDS: 1 } }));

const mockQuery = db.query as jest.Mock;
const mockWithTransaction = db.withTransaction as jest.Mock;
const mockBcryptHash = bcrypt.hash as jest.Mock;
const mockBcryptCompare = bcrypt.compare as jest.Mock;

const makeClient = (rows: unknown[] = []) => ({
  query: jest.fn().mockResolvedValue({ rows }),
});

describe("AuthService.register", () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
  });

  it("creates a new user and returns it without password_hash", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] }); // no existing user
    mockBcryptHash.mockResolvedValue("hashed_pw");

    const newUser = {
      id: "1",
      email: "user@example.com",
      password_hash: "hashed_pw",
      created_at: new Date(),
      updated_at: new Date(),
    };
    const client = makeClient([newUser]);
    mockWithTransaction.mockImplementation((fn: Function) => fn(client));

    const result = await service.register("User@Example.com", "password123");

    expect(result.email).toBe("user@example.com");
    expect(result).not.toHaveProperty("password_hash");
    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT id FROM users"),
      ["user@example.com"]
    );
  });

  it("normalises email to lowercase before saving", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });
    mockBcryptHash.mockResolvedValue("hash");

    const client = makeClient([{ id: "1", email: "upper@example.com", created_at: new Date(), updated_at: new Date() }]);
    mockWithTransaction.mockImplementation((fn: Function) => fn(client));

    await service.register("UPPER@EXAMPLE.COM", "pass");

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO users"),
      ["upper@example.com", "hash"]
    );
  });

  it("throws when email is already registered", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ id: "1" }] });

    await expect(service.register("taken@example.com", "pass")).rejects.toThrow(
      "Email already registered"
    );
    expect(mockWithTransaction).not.toHaveBeenCalled();
  });
});

describe("AuthService.login", () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
  });

  it("returns user without password_hash on valid credentials", async () => {
    const user = {
      id: "1",
      email: "user@example.com",
      password_hash: "hashed",
      created_at: new Date(),
      updated_at: new Date(),
    };
    mockQuery.mockResolvedValueOnce({ rows: [user] });
    mockBcryptCompare.mockResolvedValue(true);

    const result = await service.login("user@example.com", "correct");

    expect(result.email).toBe("user@example.com");
    expect(result).not.toHaveProperty("password_hash");
  });

  it("throws on wrong password", async () => {
    mockQuery.mockResolvedValueOnce({
      rows: [{ id: "1", email: "user@example.com", password_hash: "hash" }],
    });
    mockBcryptCompare.mockResolvedValue(false);

    await expect(service.login("user@example.com", "wrong")).rejects.toThrow(
      "Invalid credentials"
    );
  });

  it("throws when user does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(service.login("ghost@example.com", "pass")).rejects.toThrow(
      "Invalid credentials"
    );
    expect(mockBcryptCompare).not.toHaveBeenCalled();
  });

  it("queries with lowercased email", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    await expect(service.login("UPPER@EXAMPLE.COM", "pass")).rejects.toThrow();

    expect(mockQuery).toHaveBeenCalledWith(
      expect.stringContaining("SELECT * FROM users"),
      ["upper@example.com"]
    );
  });
});

describe("AuthService.findById", () => {
  let service: AuthService;

  beforeEach(() => {
    service = new AuthService();
  });

  it("returns user when found", async () => {
    const user = { id: "42", email: "user@example.com", created_at: new Date(), updated_at: new Date() };
    mockQuery.mockResolvedValueOnce({ rows: [user] });

    const result = await service.findById("42");

    expect(result).toEqual(user);
  });

  it("returns null when user does not exist", async () => {
    mockQuery.mockResolvedValueOnce({ rows: [] });

    const result = await service.findById("999");

    expect(result).toBeNull();
  });
});
