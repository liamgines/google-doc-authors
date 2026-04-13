const pool = require("./pool.ts");
const path = require("node:path");
const fs = require("node:fs");

async function queryDatabaseWithFile(pool, filePath) {
    const readFileOptions = { encoding: "utf-8", flag: "r" };
    const sql = fs.readFileSync(filePath, readFileOptions);
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
