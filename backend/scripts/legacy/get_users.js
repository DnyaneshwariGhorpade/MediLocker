const { PrismaClient } = require('@prisma/client');
const { Pool } = require('pg');
const { PrismaPg } = require('@prisma/adapter-pg');
const dotenv = require('dotenv');

dotenv.config();

async function main() {
    const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
    const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    const users = await prisma.users.findMany();
    const patients = await prisma.patients.findMany();
    const vaults = await prisma.patient_vaults.findMany();
    console.log('Users:', users.length);
    console.log('Patients:', patients.length);
    console.log('Vaults:', vaults.length);
    if(users.length > 0) {
        console.log('First user:', users[0]);
    }
}
main().catch(console.error);
