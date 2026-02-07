import express from "express";
import { config } from "./config.js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { createUser, getUserByEmail, resetUsers } from "./db/queries/users.js";
import { createChirp, getChirps, getChirpsById } from "./db/queries/chirps.js";
import { checkPassword, getBearerToken, hashPassword, makeJWT, validateJWT, } from "./auth.js";
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
    console.log("clean chirp", cleanedChirp);
    req.body = { ...req.body, body: cleanedChirp };
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
export async function login(req, res) {
    if (!req.body.email)
        throw new BadRequestError("Email is required");
    if (!req.body.password)
        throw new BadRequestError("Password is required");
    let expiresInSeconds = 60 * 60 * 1000; // 1h
    if (req.body.expiresInSeconds &&
        parseInt(req.body.expiresInSeconds) < expiresInSeconds // Do not allow > 1h expires
    ) {
        expiresInSeconds = parseInt(req.body.expiresInSeconds);
    }
    const user = await getUserByEmail(req.body.email);
    if (!user)
        throw new BadRequestError("User not found");
    const isValidPassword = await checkPassword(req.body.password, user.hashedPassword);
    if (!isValidPassword)
        throw new UnauthorizedError("Invalid credentials");
    const { hashedPassword, ...safeUser } = user;
    const jwt = makeJWT(safeUser.id, expiresInSeconds, config.secret);
    res.status(200).send({ ...safeUser, token: jwt });
}
function handleIsLoggedIn(req, res, next) {
    const token = getBearerToken(req);
    const isValid = validateJWT(token, config.secret);
    if (!isValid)
        throw new UnauthorizedError("Not valid token");
    next();
}
async function handleCreateChirp(req, res) {
    const { body, userId } = req.body;
    if (!body || !userId)
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
app.use(middlewareLogResponses);
app.use(express.json());
app.get("/api/healthz", handlerReadiness);
app.post("/admin/reset", resetMetrics);
app.get("/admin/metrics", handleMetrics);
// app.post(
//   "/api/validate_chirp",
//   middlewareCleanChirp,
//   async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       handleChirp(req, res);
//     } catch (error) {
//       next(error);
//     }
//   },
// );
app.post("/api/users", handleCreateUser);
app.post("/api/login", login);
app.get("/api/chirps", handleGetChirps);
app.get("/api/chirps/:id", handleGetChirpsById);
app.post("/api/chirps", handleIsLoggedIn, middlewareCleanChirp, handleCreateChirp);
// Order matters here, middleware comes before
app.use("/app", middlewareRegisterServerHit, express.static("."));
app.use(handleError);
app.listen(PORT, "0.0.0.0", () => {
    console.log("Server running on http://localhost:8080");
});
