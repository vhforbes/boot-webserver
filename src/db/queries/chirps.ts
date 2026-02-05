import { db } from "../index.js";
import { chirps } from "../schema.js";

export async function createChirp(userId: string, body: string) {
  const [result] = await db
    .insert(chirps)
    .values({
      userId,
      body,
    })
    .returning();

  return result;
}
