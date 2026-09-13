import crypto from 'crypto';
import { DecryptCommand, EncryptCommand, KMSClient } from '@aws-sdk/client-kms';
import { env } from '../config/env';

/**
 * Wraps and unwraps per-file data encryption keys.
 *
 * The application never persists a plaintext DEK. It asks the provider to wrap
 * one, stores the wrapped form alongside the record, and asks the provider to
 * unwrap it again on read. Swapping `LocalKeyProvider` for a KMS-backed
 * implementation therefore requires no change at the call sites.
 */
export interface WrappedKey {
    /** Base64 ciphertext of the DEK. */
    ciphertext: string;
    /** Base64 IV used to wrap it. */
    iv: string;
    /** Base64 GCM authentication tag. */
    authTag: string;
    /** Identifier of the master key that performed the wrap. */
    keyId: string;
}

export interface KeyProvider {
    readonly keyId: string;
    generateDataKey(): Buffer;
    wrap(dataKey: Buffer): Promise<WrappedKey>;
    unwrap(wrapped: WrappedKey): Promise<Buffer>;
}

const DEK_BYTES = 32; // AES-256
const IV_BYTES = 12; // GCM standard nonce length

/**
 * Wraps DEKs with a master key held in the process environment.
 *
 * This is the development implementation. It provides real AES-256-GCM
 * envelope encryption, but the master key lives in the same trust domain as the
 * database, so it does not deliver the property the architecture document
 * describes — that a database administrator cannot decrypt records. An AWS KMS
 * provider (task P5-11) closes that gap.
 */
export class LocalKeyProvider implements KeyProvider {
    readonly keyId = 'local-master-key-v1';
    private readonly masterKey: Buffer;

    constructor(masterKeyBase64: string) {
        const key = Buffer.from(masterKeyBase64, 'base64');
        if (key.length !== 32) {
            throw new Error(
                `KMS_MASTER_KEY must decode to 32 bytes, got ${key.length}. ` +
                    'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
            );
        }
        this.masterKey = key;
    }

    generateDataKey(): Buffer {
        return crypto.randomBytes(DEK_BYTES);
    }

    async wrap(dataKey: Buffer): Promise<WrappedKey> {
        const iv = crypto.randomBytes(IV_BYTES);
        const cipher = crypto.createCipheriv('aes-256-gcm', this.masterKey, iv);
        const ciphertext = Buffer.concat([cipher.update(dataKey), cipher.final()]);

        return {
            ciphertext: ciphertext.toString('base64'),
            iv: iv.toString('base64'),
            authTag: cipher.getAuthTag().toString('base64'),
            keyId: this.keyId,
        };
    }

    async unwrap(wrapped: WrappedKey): Promise<Buffer> {
        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            this.masterKey,
            Buffer.from(wrapped.iv, 'base64')
        );
        decipher.setAuthTag(Buffer.from(wrapped.authTag, 'base64'));
        return Buffer.concat([
            decipher.update(Buffer.from(wrapped.ciphertext, 'base64')),
            decipher.final(),
        ]);
    }
}

/**
 * Wraps DEKs with AWS KMS.
 *
 * This is the arrangement the architecture document describes: the master key
 * lives in a hardware security module the application can call but cannot
 * export, so a database compromise alone does not yield plaintext records.
 *
 * NOTE: this path has not been exercised against a real KMS key in this
 * environment — no AWS credentials were available. It is wired and type-checked
 * but should be validated against a development key before production use.
 */
export class KmsKeyProvider implements KeyProvider {
    readonly keyId: string;
    private readonly client: KMSClient;

    constructor(keyId: string, region: string) {
        this.keyId = keyId;
        this.client = new KMSClient({ region });
    }

    generateDataKey(): Buffer {
        // The DEK is generated locally and only wrapped by KMS, which keeps one
        // network round trip per upload instead of two.
        return crypto.randomBytes(DEK_BYTES);
    }

    async wrap(dataKey: Buffer): Promise<WrappedKey> {
        const response = await this.client.send(
            new EncryptCommand({ KeyId: this.keyId, Plaintext: dataKey })
        );

        if (!response.CiphertextBlob) {
            throw new Error('KMS returned no ciphertext for the data key.');
        }

        return {
            ciphertext: Buffer.from(response.CiphertextBlob).toString('base64'),
            // KMS envelopes are self-describing, so these are unused here but
            // kept so the stored shape matches the local provider.
            iv: '',
            authTag: '',
            keyId: response.KeyId ?? this.keyId,
        };
    }

    async unwrap(wrapped: WrappedKey): Promise<Buffer> {
        const response = await this.client.send(
            new DecryptCommand({
                KeyId: this.keyId,
                CiphertextBlob: Buffer.from(wrapped.ciphertext, 'base64'),
            })
        );

        if (!response.Plaintext) {
            throw new Error('KMS returned no plaintext for the wrapped data key.');
        }

        return Buffer.from(response.Plaintext);
    }
}

let provider: KeyProvider | null = null;

export function getKeyProvider(): KeyProvider {
    if (provider) return provider;

    if (env.keyProviderDriver === 'KMS') {
        if (!env.awsKmsKeyId) {
            throw new Error('KEY_PROVIDER=KMS requires AWS_KMS_KEY_ID. See backend/.env.example.');
        }
        provider = new KmsKeyProvider(env.awsKmsKeyId, env.awsRegion);
        return provider;
    }

    if (!env.kmsMasterKey) {
        throw new Error(
            'KMS_MASTER_KEY is not set. The encrypted file pipeline cannot run without it. See backend/.env.example.'
        );
    }

    provider = new LocalKeyProvider(env.kmsMasterKey);
    return provider;
}

/** Test seam. */
export function setKeyProvider(next: KeyProvider | null): void {
    provider = next;
}
