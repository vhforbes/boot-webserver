import express from "express";
import { config } from "./config.js";
const app = express();
const PORT = 8080;
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
function resetMetrics(req, res) {
    config.fileServerHits = 0;
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
        res.status(400).send({ error: "Chirp is too long" });
        return;
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
    req.body = { cleanedBody: cleanedChirp };
    next();
}
app.use(middlewareLogResponses);
app.use(express.json());
app.get("/api/healthz", handlerReadiness);
app.post("/admin/reset", resetMetrics);
app.get("/admin/metrics", handleMetrics);
app.post("/api/validate_chirp", middlewareCleanChirp, handleChirp);
// Order matters here, middleware comes before
app.use("/app", middlewareRegisterServerHit, express.static("."));
app.listen(PORT, "0.0.0.0", () => {
    console.log("Server running on http://localhost:8080");
});
