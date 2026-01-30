import express, { NextFunction, Request, Response } from "express";
import { config } from "./config.js";

const app = express();
const PORT = 8080;

function handlerReadiness(req: Request, res: Response) {
  res.set({
    "Content-Type": "text/plain; charset=utf-8",
  });

  res.send("OK");
}

function handleMetrics(req: Request, res: Response) {
  console.log("handleMetrics");

  res.set({
    "Content-Type": "text/html; charset=utf-8",
  });

  res.send(`
    <html>
      <body>
        <h1>Welcome, Chirpy Admin</h1>
        <p>Chirpy has been visited ${config.fileserverHits} times!</p>
      </body>
    </html>
  `);
}

function resetMetrics(req: Request, res: Response) {
  config.fileserverHits = 0;

  res.set({
    "Content-Type": "text/plain; charset=utf-8",
  });

  res.send("Metrics reset");
}

function middlewareLogResponses(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  res.on("finish", () => {
    if (res.statusCode >= 400) {
      console.log(
        `[NON-OK] ${req.method} ${req.url} - Status: ${res.statusCode}`,
      );
    }
  });

  next();
}

function middlewareRegisterServerHit(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  res.on("finish", () => {
    console.log(req.originalUrl);

    if (req.originalUrl.includes("/app")) config.fileserverHits += 1;
  });

  next();
}

function handleChirp(req: Request, res: Response) {
  let body = "";

  req.on("data", (chunk) => {
    body += chunk;
  });

  req.on("end", () => {
    try {
      const parsedBody = JSON.parse(body);

      console.log(parsedBody);

      if (parsedBody.body.length > 120) {
        res.status(400).send({ error: "Chirp is too long" });
        return;
      }

      res.status(200).send({ valid: true });
      return;
    } catch (error) {
      res.status(400).send({
        error: "Something went wrong",
      });
    }
  });
}

app.use(middlewareLogResponses);

app.get("/api/healthz", handlerReadiness);
app.post("/admin/reset", resetMetrics);
app.get("/admin/metrics", handleMetrics);

app.post("/api/validate_chirp", handleChirp);

// Order matters here, middleware comes before
app.use("/app", middlewareRegisterServerHit, express.static("."));

app.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on http://localhost:8080");
});
