import { asc, eq } from "drizzle-orm";
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

export async function getChirps() {
  const result = await db.select().from(chirps).orderBy(asc(chirps.createdAt));

  return result;
}

export async function getChirpsByUserId(userId: string) {
  const result = await db
    .select()
    .from(chirps)
    .orderBy(asc(chirps.createdAt))
    .where(eq(chirps.userId, userId));

  return result;
}

export async function getChirpsById(id: string) {
  const [result] = await db.select().from(chirps).where(eq(chirps.id, id));

  return result;
}

export async function deleteChirpById(id: string) {
  await db.delete(chirps).where(eq(chirps.id, id));
}
