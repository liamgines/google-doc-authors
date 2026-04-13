const pool = require("./pool.ts");

async function seedDatabase() {
    await pool.query(`DROP TABLE IF EXISTS users`);
    await pool.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name TEXT)`);
    await pool.query(`INSERT INTO users (name) VALUES ($1), ($2)`, ["one", "two"]);
    const result = await pool.query(`SELECT * FROM users`);
    console.log(result.rows);

    await pool.end();
};

seedDatabase();
