import pg, { type Pool } from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_CONNECTION_STRING });

export type DbPool = Pool;
export default pool;
