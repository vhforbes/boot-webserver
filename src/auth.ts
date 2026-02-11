import { hash, verify } from "argon2";
import { Request } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import crypto from "crypto";
import { createRefreshToken } from "./db/queries/refreshTokens.js";

type payload = Pick<JwtPayload, "iss" | "sub" | "iat" | "exp">;

export async function hashPassword(password: string) {
  return await hash(password);
}

export async function checkPassword(password: string, hash: string) {
  return await verify(hash, password);
}

export function makeJWT(userID: string, expiresIn: number, secret: string) {
  const payload: payload = {
    iss: "chirpy",
    sub: userID,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresIn,
  };

  const newJwt = jwt.sign(payload, secret);

  return newJwt;
}

export function validateJWT(tokenString: string, secret: string): string {
  const decoded = jwt.verify(tokenString, secret) as JwtPayload;

  if (!decoded.sub || typeof decoded.sub !== "string") {
    throw new Error("Invalid JWT subject");
  }

  return decoded.sub;
}

export function getBearerToken(req: Request): string {
  const authHeader = req.headers.authorization;

  if (!authHeader) throw new Error("Authorization Header not present");

  const token = authHeader?.slice("Bearer ".length).trim();

  return token;
}

export async function makeRefreshToken(userId: string) {
  const token = crypto.randomBytes(32).toString("hex");

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 60);

  await createRefreshToken(token, expiresAt, userId);

  return token;
}

export function getApiKey(req: Request): string {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    throw new Error("Authorization header not present");
  }

  if (!authHeader.startsWith("ApiKey ")) {
    throw new Error("Invalid authorization format");
  }

  return authHeader.slice(7).trim();
}
