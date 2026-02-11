import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { refreshTokens } from "../schema.js";

export async function createRefreshToken(
  token: string,
  expiresAt: Date,
  userId: string,
) {
  const newEntry = await db
    .insert(refreshTokens)
    .values({
      token,
      expiresAt,
      userId,
    })
    .returning();

  return newEntry;
}

export async function getRefreshToken(refreshToken: string) {
  const [token] = await db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.token, refreshToken));

  return token;
}

export async function revokeRefreshToken(refreshToken: string) {
  const now = new Date(Date.now());

  const [token] = await db
    .update(refreshTokens)
    .set({
      revokedAt: now,
      updatedAt: now,
    })
    .where(eq(refreshTokens.token, refreshToken))
    .returning();

  return token;
}
