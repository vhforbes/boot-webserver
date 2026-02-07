import { hash, verify } from "argon2";
import { Request } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

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

export function validateJWT(tokenString: string, secret: string) {
  try {
    const token = jwt.verify(tokenString, secret);

    return token.sub;
  } catch (error) {
    console.log("Unable to decode JWT Token");
  }
}

export function getBearerToken(req: Request): string {
  const authHeader = req.headers.authorization;

  if (!authHeader) throw new Error("Authorization Header not present");

  const token = authHeader?.slice("Bearer ".length).trim();

  return token;
}
