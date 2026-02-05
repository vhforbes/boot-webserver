import { MigrationConfig } from "drizzle-orm/migrator";

process.loadEnvFile();

const envOrThrow = (name: string) => {
  if (!process.env[name]) {
    throw new Error("DB_URL not found");
  }

  return process.env[name];
};

type DBConfig = {
  dbUrl: string;
  migrationConfig: MigrationConfig;
};

type APIConfig = {
  fileServerHits: number;
  plataform: string;
  dbConfig: DBConfig;
};

const migrationConfig: MigrationConfig = {
  migrationsFolder: "./src/db/migrations",
};

const dbConfig: DBConfig = {
  dbUrl: envOrThrow("DB_URL"),
  migrationConfig,
};

export const config: APIConfig = {
  fileServerHits: 0,
  dbConfig,
  plataform: envOrThrow("PLATAFORM"),
};
