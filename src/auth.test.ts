import { describe, it, expect, beforeAll } from "vitest";
import { checkPassword, hashPassword, makeJWT, validateJWT } from "./auth";
import { NewUser } from "./db/schema";

describe("Password Hashing", () => {
  const password1 = "correctPassword123!";
  const password2 = "anotherPassword456!";
  let hash1: string;
  let hash2: string;

  beforeAll(async () => {
    hash1 = await hashPassword(password1);
    hash2 = await hashPassword(password2);
  });

  it("should return true for the correct password", async () => {
    const result = await checkPassword(password1, hash1);
    expect(result).toBe(true);
  });
});

describe("JWT Management", () => {
  const userId = "user-id";
  const expiresIn = 100;
  const secret = "123";

  it("should make jwt and validate it with correct payload", () => {
    const jwt = makeJWT(userId, expiresIn, secret);

    expect(jwt).toBeTruthy();

    const userIdAfterDecode = validateJWT(jwt, secret);

    expect(userIdAfterDecode).toEqual("user-id");
  });
});
