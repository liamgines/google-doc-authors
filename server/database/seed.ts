import pool, { type DbPool } from "./pool";
import path from "node:path";
import fs from "node:fs";

async function queryDatabaseWithFile(pool: DbPool, filePath: string) {
    const sql = fs.readFileSync(filePath, { encoding: "utf-8", flag: "r" });
    return await pool.query(sql);
}

async function seedDatabase() {
    await queryDatabaseWithFile(pool, path.join(__dirname, "./reset.sql"));
    await queryDatabaseWithFile(pool, path.join(__dirname,  "./seed.sql"));

    /*
    await pool.query(`INSERT INTO authors DEFAULT VALUES`);
    const result = await pool.query(`SELECT * FROM authors`);
    console.log(result.rows);
    */

    await pool.end();
};

seedDatabase();
