import express from "express";
import { config } from "./config.js";
import postgres from "postgres";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import { createUser, resetUsers } from "./db/queries/users.js";
import { createChirp } from "./db/queries/chirps.js";
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
    const user = await createUser({ email: req.body.email });
    res.status(201).send(user);
}
async function handleCreateChirp(req, res) {
    const { body, userId } = req.body;
    if (!body || !userId)
        throw new BadRequestError("Missing params for chirping");
    const chirp = await createChirp(userId, body);
    console.log(chirp);
    res.status(201).send(chirp);
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
app.post("/api/chirps", middlewareCleanChirp, handleCreateChirp);
// Order matters here, middleware comes before
app.use("/app", middlewareRegisterServerHit, express.static("."));
app.use(handleError);
app.listen(PORT, "0.0.0.0", () => {
    console.log("Server running on http://localhost:8080");
});
