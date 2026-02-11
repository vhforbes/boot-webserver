import express from "express";
import { config } from "./config.js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { createUser, getUserByEmail, resetUsers, updateUser, updateUserToRed, } from "./db/queries/users.js";
import { createChirp, deleteChirpById, getChirps, getChirpsById, } from "./db/queries/chirps.js";
import { checkPassword, getApiKey, getBearerToken, hashPassword, makeJWT, makeRefreshToken, validateJWT, } from "./auth.js";
import { getRefreshToken, revokeRefreshToken, } from "./db/queries/refreshTokens.js";
// Check if everything is in sync with db
const migrationClient = postgres(config.dbConfig.dbUrl, { max: 1 });
await migrate(drizzle(migrationClient), config.dbConfig.migrationConfig);
const app = express();
const PORT = 8080;
class BadRequestError extends Error {
    constructor(message) {
        super(message);
    }
}
class UnauthorizedError extends Error {
    constructor(message) {
        super(message);
    }
}
class ForbiddenError extends Error {
    constructor(message) {
        super(message);
    }
}
class NotFoundError extends Error {
    constructor(message) {
        super(message);
    }
}
function handlerReadiness(req, res) {
    res.set({
        "Content-Type": "text/plain; charset=utf-8",
    });
    res.send("OK");
}
function handleMetrics(req, res) {
    console.log("handleMetrics");
    res.set({
        "Content-Type": "text/html; charset=utf-8",
    });
    res.send(`
    <html>
      <body>
        <h1>Welcome, Chirpy Admin</h1>
        <p>Chirpy has been visited ${config.fileServerHits} times!</p>
      </body>
    </html>
  `);
}
async function resetMetrics(req, res) {
    if (config.plataform !== "DEV")
        throw new ForbiddenError("Only allowed in dev");
    config.fileServerHits = 0;
    await resetUsers();
    res.set({
        "Content-Type": "text/plain; charset=utf-8",
    });
    res.send("Metrics reset");
}
function middlewareLogResponses(req, res, next) {
    res.on("finish", () => {
        if (res.statusCode >= 400) {
            console.log(`[NON-OK] ${req.method} ${req.url} - Status: ${res.statusCode}`);
        }
    });
    next();
}
function middlewareRegisterServerHit(req, res, next) {
    res.on("finish", () => {
        console.log(req.originalUrl);
        if (req.originalUrl.includes("/app"))
            config.fileServerHits += 1;
    });
    next();
}
function handleChirp(req, res) {
    if (req.body.cleanedBody.length > 120) {
        throw new BadRequestError("Chirp is too long. Max length is 140");
    }
    res.status(200).send(req.body);
    return;
}
function middlewareCleanChirp(req, res, next) {
    let chirp = req.body.body;
    // split phrase into words
    // check each word and replace on string position
    // put i togheter again
    const replaceForbiddenWord = (originalWord) => {
        const word = originalWord.toLocaleLowerCase();
        if (word.includes("kerfuffle")) {
            return "****";
        }
        if (word.includes("sharbert")) {
            return "****";
        }
        if (word.includes("fornax")) {
            return "****";
        }
        return originalWord;
    };
    const chirpArray = chirp.split(" ");
    chirpArray.forEach((word, i) => {
        chirpArray[i] = replaceForbiddenWord(word);
    });
    const cleanedChirp = chirpArray.join(" ");
    req.body = { ...req.body, body: cleanedChirp };
    console.log(req.body);
    next();
}
function handleError(err, req, res, next) {
    console.log("error: ", err);
    if (err instanceof BadRequestError) {
        res.status(400).json({
            error: err.message,
        });
    }
    else if (err instanceof UnauthorizedError) {
        res.status(401).json({
            error: err.message,
        });
    }
    else if (err instanceof NotFoundError) {
        res.status(404).json({
            error: err.message,
        });
    }
    else if (err instanceof ForbiddenError) {
        res.status(403).json({
            error: err.message,
        });
    }
    else {
        res.status(500).json({
            error: "Something went wrong on our end",
        });
    }
    res;
}
async function handleCreateUser(req, res) {
    if (!req.body.email)
        throw new BadRequestError("Email is required");
    if (!req.body.password)
        throw new BadRequestError("Password is required");
    const newHashedPassword = await hashPassword(req.body.password);
    const user = await createUser({
        email: req.body.email,
        hashedPassword: newHashedPassword,
    });
    const { hashedPassword, ...safeUser } = user;
    res.status(201).send(safeUser);
}
async function handleUpdateUser(req, res) {
    if (!req.body.email)
        throw new BadRequestError("Email is required");
    if (!req.body.password)
        throw new BadRequestError("Password is required");
    let userIdFromJwt;
    try {
        userIdFromJwt = validateJWT(getBearerToken(req), config.secret);
    }
    catch {
        throw new UnauthorizedError("Jwt not valid");
    }
    const newPassword = await hashPassword(req.body.password);
    const updatedUser = await updateUser(userIdFromJwt, req.body.email, newPassword);
    const { hashedPassword, ...safeUser } = updatedUser;
    res.status(200).send(safeUser);
}
async function handleCreateChirp(req, res) {
    const { body, userId } = req.body;
    if (!body)
        throw new BadRequestError("Missing params for chirping");
    const chirp = await createChirp(userId, body);
    console.log(chirp);
    res.status(201).send(chirp);
}
async function handleGetChirps(req, res) {
    const chirps = await getChirps();
    res.status(200).send(chirps);
}
async function handleGetChirpsById(req, res) {
    const { id } = req.params;
    if (!id || Array.isArray(id))
        throw new BadRequestError("Invalid Id received");
    const chirps = await getChirpsById(id);
    if (!chirps)
        throw new NotFoundError("Chirp not found");
    res.status(200).send(chirps);
}
async function handleDeleteChirp(req, res) {
    let userIdFromJwt;
    try {
        userIdFromJwt = validateJWT(getBearerToken(req), config.secret);
    }
    catch {
        throw new UnauthorizedError("Jwt not valid");
    }
    const { id } = req.params;
    if (!id || Array.isArray(id))
        throw new BadRequestError("Invalid Id received");
    const chirpToDelete = await getChirpsById(id);
    if (!chirpToDelete)
        throw new NotFoundError("Chirp not found");
    if (chirpToDelete.userId !== userIdFromJwt)
        throw new ForbiddenError("You cant delete this chirp");
    await deleteChirpById(chirpToDelete.id);
    res.status(204).send();
}
export async function login(req, res) {
    if (!req.body.email)
        throw new BadRequestError("Email is required");
    if (!req.body.password)
        throw new BadRequestError("Password is required");
    let expiresInSeconds = 60 * 60 * 1000; // 1h
    const user = await getUserByEmail(req.body.email);
    if (!user)
        throw new BadRequestError("User not found");
    const isValidPassword = await checkPassword(req.body.password, user.hashedPassword);
    if (!isValidPassword)
        throw new UnauthorizedError("Invalid credentials");
    const refreshToken = await makeRefreshToken(user.id);
    const { hashedPassword, ...safeUser } = user;
    const jwt = makeJWT(safeUser.id, expiresInSeconds, config.secret);
    res.status(200).send({ ...safeUser, token: jwt, refreshToken });
}
async function refreshToken(req, res) {
    const token = await getRefreshToken(getBearerToken(req));
    if (!token)
        throw new UnauthorizedError("refresh token not found");
    const now = new Date(Date.now());
    if (token.revokedAt && token.revokedAt <= now)
        throw new UnauthorizedError("refresh token revoked");
    if (token.expiresAt && token.expiresAt <= now)
        throw new UnauthorizedError("refresh token expired");
    let expiresInSeconds = 60 * 60 * 1000;
    const jwt = makeJWT(token.userId, expiresInSeconds, config.secret);
    res.status(200).send({
        token: jwt,
    });
}
async function revokeToken(req, res) {
    const token = await getRefreshToken(getBearerToken(req));
    if (!token)
        throw new UnauthorizedError("refresh token not found");
    await revokeRefreshToken(token.token);
    res.status(204).send();
}
function handleIsLoggedIn(req, res, next) {
    const token = getBearerToken(req);
    const userId = validateJWT(token, config.secret);
    if (!userId)
        throw new UnauthorizedError("Not valid token");
    req.body.userId = userId;
    next();
}
async function setUserRed(req, res) {
    if (!req.body.event)
        throw new BadRequestError("Event is required");
    if (!req.body.data.userId)
        throw new BadRequestError("userId is required");
    if (req.body.event !== "user.upgraded") {
        res.status(204).send();
        return;
    }
    const updatedUser = await updateUserToRed(req.body.data.userId);
    if (!updatedUser)
        throw new NotFoundError("User not found");
    res.status(204).send();
}
function validatePolkaApi(req, res, next) {
    try {
        if (config.polkaApiKey !== getApiKey(req))
            return next(new UnauthorizedError("Not valid polka api key"));
        next();
    }
    catch (error) {
        return next(new UnauthorizedError("Not valid polka api key"));
    }
}
app.use(middlewareLogResponses);
app.use(express.json());
app.get("/api/healthz", handlerReadiness);
app.get("/admin/metrics", handleMetrics);
app.post("/admin/reset", resetMetrics);
app.post("/api/users", handleCreateUser);
app.put("/api/users", handleUpdateUser);
app.post("/api/login", login);
app.post("/api/refresh", refreshToken);
app.post("/api/revoke", revokeToken);
app.get("/api/chirps", handleGetChirps);
app.get("/api/chirps/:id", handleGetChirpsById);
app.delete("/api/chirps/:id", handleDeleteChirp);
app.post("/api/chirps", handleIsLoggedIn, middlewareCleanChirp, handleCreateChirp);
app.post("/api/polka/webhooks", validatePolkaApi, setUserRed);
// Order matters here, middleware comes before
app.use("/app", middlewareRegisterServerHit, express.static("."));
app.use(handleError);
app.listen(PORT, "0.0.0.0", () => {
    console.log("Server running on http://localhost:8080");
});
