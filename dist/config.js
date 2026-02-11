process.loadEnvFile();
const envOrThrow = (name) => {
    if (!process.env[name]) {
        throw new Error("DB_URL not found");
    }
    return process.env[name];
};
const migrationConfig = {
    migrationsFolder: "./src/db/migrations",
};
const dbConfig = {
    dbUrl: envOrThrow("DB_URL"),
    migrationConfig,
};
export const config = {
    fileServerHits: 0,
    secret: envOrThrow("SECRET"),
    plataform: envOrThrow("PLATAFORM"),
    dbConfig,
    polkaApiKey: envOrThrow("POLKA_KEY"),
};
