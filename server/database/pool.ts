import pg, { type Pool, type Result } from "pg";

const pool = new pg.Pool({ connectionString: process.env.PRIVATE_DATABASE_CONNECTION_STRING });

export type DbPool = Pool;
export type DbResult = Result;
export default pool;
