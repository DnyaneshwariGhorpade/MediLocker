
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

    console.log('Testing Registration with Vault Creation...');
    try {
        const email = `test.vault.${Date.now()}@example.com`;
        const res = await fetch('http://localhost:3000/api/auth/register/patient', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email,
                phone_number: `${Math.floor(Math.random() * 10000000000)}`,
                password: 'password123',
                aadhaar_hash: `AADHAAR-${Date.now()}`,
                first_name: 'Test',
                last_name: 'Vault',
                date_of_birth: '1995-05-05',
                gender: 'MALE'
            })
        });
        const data = await res.json();
        console.log('Registration Response:', data);
        
        const userId = data.userId;
        const patient = await prisma.patients.findUnique({
            where: { user_id: userId },
            include: { patient_vaults: true }
        });
        
        console.log('Created Patient:', patient.first_name);
        console.log('Created Vault:', patient.patient_vaults ? patient.patient_vaults.vault_number : 'NONE - FAILED');
        
        if (patient.patient_vaults) {
            console.log('✅ Vault successfully created on registration!');
        } else {
            console.log('❌ Vault creation failed.');
        }

    } catch (err) {
        console.error('Test failed:', err.response ? err.response.data : err.message);
    }
}
main();
