import fs from 'fs/promises';
import path from 'path';
import {
    DeleteObjectCommand,
    GetObjectCommand,
    HeadObjectCommand,
    PutObjectCommand,
    S3Client,
} from '@aws-sdk/client-s3';
import { env } from '../config/env';

/**
 * Stores and retrieves encrypted record payloads.
 *
 * Only ciphertext is ever handed to an implementation, so the storage backend
 * is outside the decryption trust boundary. Swapping the local driver for S3
 * requires no change at the call sites.
 */
export interface ObjectStorage {
    readonly driver: 'LOCAL' | 'S3';
    put(key: string, data: Buffer): Promise<void>;
    get(key: string): Promise<Buffer>;
    delete(key: string): Promise<void>;
    exists(key: string): Promise<boolean>;
}

export class LocalDiskStorage implements ObjectStorage {
    readonly driver = 'LOCAL' as const;
    private readonly root: string;

    constructor(root: string) {
        this.root = path.resolve(root);
    }

    /**
     * Resolves a storage key to an absolute path, refusing anything that
     * escapes the storage root.
     */
    private resolve(key: string): string {
        const target = path.resolve(this.root, key);
        const rootWithSep = this.root.endsWith(path.sep) ? this.root : this.root + path.sep;
        if (!target.startsWith(rootWithSep)) {
            throw new Error(`Refusing to access a path outside the storage root: ${key}`);
        }
        return target;
    }

    async put(key: string, data: Buffer): Promise<void> {
        const target = this.resolve(key);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, data);
    }

    async get(key: string): Promise<Buffer> {
        return fs.readFile(this.resolve(key));
    }

    async delete(key: string): Promise<void> {
        await fs.rm(this.resolve(key), { force: true });
    }

    async exists(key: string): Promise<boolean> {
        try {
            await fs.access(this.resolve(key));
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Stores ciphertext in an S3 bucket.
 *
 * NOTE: not exercised against a real bucket in this environment — no AWS
 * credentials were available. It is wired and type-checked, but should be
 * validated against a development bucket before production use. Server-side
 * encryption is requested in addition to the application-level envelope, so a
 * misconfiguration does not leave objects at rest unprotected.
 */
export class S3Storage implements ObjectStorage {
    readonly driver = 'S3' as const;
    private readonly client: S3Client;
    private readonly bucket: string;

    constructor(bucket: string, region: string) {
        this.bucket = bucket;
        this.client = new S3Client({ region });
    }

    async put(key: string, data: Buffer): Promise<void> {
        await this.client.send(
            new PutObjectCommand({
                Bucket: this.bucket,
                Key: key,
                Body: data,
                ServerSideEncryption: 'AES256',
            })
        );
    }

    async get(key: string): Promise<Buffer> {
        const response = await this.client.send(
            new GetObjectCommand({ Bucket: this.bucket, Key: key })
        );

        if (!response.Body) throw new Error(`Object not found: ${key}`);
        return Buffer.from(await response.Body.transformToByteArray());
    }

    async delete(key: string): Promise<void> {
        await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    }

    async exists(key: string): Promise<boolean> {
        try {
            await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
            return true;
        } catch {
            return false;
        }
    }
}

let storage: ObjectStorage | null = null;

export function getObjectStorage(): ObjectStorage {
    if (storage) return storage;

    if (env.storageDriver === 'S3') {
        if (!env.s3Bucket) {
            throw new Error('STORAGE_DRIVER=S3 requires S3_BUCKET. See backend/.env.example.');
        }
        storage = new S3Storage(env.s3Bucket, env.awsRegion);
        return storage;
    }

    storage = new LocalDiskStorage(env.storagePath);
    return storage;
}

/** Test seam. */
export function setObjectStorage(next: ObjectStorage | null): void {
    storage = next;
}
