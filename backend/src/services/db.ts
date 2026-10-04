import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import dotenv from 'dotenv';

dotenv.config();

// Runtime queries must use the transaction pooler (DATABASE_URL, :6543).
// DIRECT_URL is the session pooler and is reserved for migrations; on Supabase
// it is often unreachable from the app, so it is only a last-resort fallback.
const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
const pool = new Pool({ 
    connectionString,
    ssl: { rejectUnauthorized: false } 
});
const adapter = new PrismaPg(pool);

export const db = new PrismaClient({ adapter });
