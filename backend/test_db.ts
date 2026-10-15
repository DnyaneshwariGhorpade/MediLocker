import { db } from './src/services/db';
async function test() {
    try {
        console.log('Testing connection...');
        const res = await db.patients.findMany({ take: 1 });
        console.log('Success:', res.length);
    } catch (e) {
        console.error('Error:', e);
    } finally {
        await db.$disconnect();
    }
}
test();
