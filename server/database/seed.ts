import pool from "./pool";
import path from "node:path";
import { databaseQueryWithFile } from "./helpers";

const CREATE_SESSION_TABLE_SQL_FILE_PATH = "../node_modules/connect-pg-simple/table.sql";

async function seedDatabase() {
    await databaseQueryWithFile(pool, path.join(__dirname, "./reset.sql"));
    await databaseQueryWithFile(pool, path.join(__dirname,  "./seed.sql"));
    await databaseQueryWithFile(pool, path.join(__dirname, CREATE_SESSION_TABLE_SQL_FILE_PATH));
    await pool.end();
};

seedDatabase();
