import pool from "./pool";
import path from "node:path";
import fs from "node:fs";
import { databaseQueryWithFile } from "./helpers";

const CREATE_SESSION_TABLE_SQL_FILE_PATH = "../node_modules/connect-pg-simple/table.sql";

async function seedDatabase() {
    await databaseQueryWithFile(pool, path.join(__dirname, "./reset.sql"));

    const userDocsPath = path.join(__dirname, "../user_docs");
    // https://stackoverflow.com/a/26815894/32242805
    if (fs.existsSync(userDocsPath)) fs.rmSync(userDocsPath, { recursive: true, force: true });
    fs.mkdirSync(userDocsPath);

    await databaseQueryWithFile(pool, path.join(__dirname,  "./seed.sql"));
    await databaseQueryWithFile(pool, path.join(__dirname, CREATE_SESSION_TABLE_SQL_FILE_PATH));

    await pool.end();
};

seedDatabase();
