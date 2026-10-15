import { Redis } from 'ioredis';

async function testRedis() {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    const client = new Redis(url);
    
    client.on('error', err => console.log('Redis Client Error', err));
    
    try {
        console.log('Redis connection successful');
        const ping = await client.ping();
        console.log('Redis ping successful:', ping);
    } catch (e) {
        console.error('Redis connection failed:', e);
    } finally {
        client.disconnect();
    }
}
testRedis();
