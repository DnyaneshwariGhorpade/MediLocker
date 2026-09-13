import { createApp } from './app';
import { env } from './config/env';
import { startScheduler, stopScheduler } from './jobs';
import { getCache } from './services/cache';

const app = createApp();

const server = app.listen(env.port, () => {
    console.log(`MediLocker API listening on port ${env.port} (${env.nodeEnv})`);
    console.log(`CORS origins: ${env.corsOrigins.join(', ')}`);
    console.log(`Storage: ${env.storageDriver} | Key provider: ${env.keyProviderDriver} | Cache: ${getCache().driver}`);
    startScheduler();
});

/** Finish in-flight requests before exiting, so a deploy does not drop them. */
const shutdown = (signal: string) => {
    console.log(`${signal} received, shutting down.`);
    stopScheduler();
    server.close(() => {
        void getCache().close().finally(() => process.exit(0));
    });
    // Do not hang forever if a connection refuses to close.
    setTimeout(() => process.exit(1), 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
