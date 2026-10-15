import { db } from './src/services/db';
import { decryptSecret } from './src/services/mfa';

async function test() {
    try {
        const user = await db.users.findUnique({ where: { email: 'admin@medilocker.com' } });
        if (!user) throw new Error('No admin user');
        console.log('MFA Secret from DB:', user.mfa_secret);
        if (user.mfa_secret) {
            const secret = await decryptSecret(user.mfa_secret);
            console.log('Decrypted secret successfully:', secret);
        } else {
            console.log('No mfa_secret found');
        }
    } catch (e: any) {
        console.error('Error decrypting:', e);
    } finally {
        await db.$disconnect();
    }
}
test();
