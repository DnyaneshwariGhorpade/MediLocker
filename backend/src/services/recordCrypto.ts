import crypto from 'crypto';
import { getKeyProvider, WrappedKey } from './keyProvider';
import { getObjectStorage } from './objectStorage';

export const ENCRYPTION_ALGORITHM = 'AES-256-GCM';

const IV_BYTES = 12;
const TAG_BYTES = 16;

export interface EncryptedUpload {
    /** Storage key the ciphertext was written under. */
    storageKey: string;
    /** Driver that holds it. */
    storageDriver: 'LOCAL' | 'S3';
    /** SHA-256 of the *plaintext*, computed server-side. */
    sha256: string;
    /** Wrapped data encryption key, for persistence alongside the record. */
    wrappedKey: WrappedKey;
    /** Base64 IV used for the payload. */
    iv: string;
    /** Size of the original plaintext in bytes. */
    plaintextBytes: number;
}

/**
 * Encrypts a file and writes the ciphertext to object storage.
 *
 * Envelope encryption: a fresh data encryption key encrypts the payload with
 * AES-256-GCM; the DEK is then wrapped by the key provider and only the wrapped
 * form is persisted. The plaintext DEK exists only for the duration of this
 * call and is zeroed before returning.
 *
 * The stored object is `ciphertext || authTag`, so integrity is verified on
 * read and a truncated or altered object fails to decrypt rather than
 * returning corrupt data.
 */
export async function encryptAndStore(
    plaintext: Buffer,
    storageKey: string
): Promise<EncryptedUpload> {
    const keyProvider = getKeyProvider();
    const storage = getObjectStorage();

    const dek = keyProvider.generateDataKey();

    try {
        const iv = crypto.randomBytes(IV_BYTES);
        const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
        const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
        const authTag = cipher.getAuthTag();

        // The hash covers the plaintext, so it can be recomputed by anyone
        // holding the original file — which is what the public verifier does.
        const sha256 = crypto.createHash('sha256').update(plaintext).digest('hex');

        await storage.put(storageKey, Buffer.concat([ciphertext, authTag]));

        const wrappedKey = await keyProvider.wrap(dek);

        return {
            storageKey,
            storageDriver: storage.driver,
            sha256,
            wrappedKey,
            iv: iv.toString('base64'),
            plaintextBytes: plaintext.length,
        };
    } finally {
        // Remove the plaintext key from memory as soon as it is no longer needed.
        dek.fill(0);
    }
}

export interface StoredEnvelope {
    storageKey: string;
    iv: string;
    wrappedKey: WrappedKey;
    expectedSha256?: string;
}

/**
 * Retrieves and decrypts a stored payload.
 *
 * Throws when the GCM tag does not verify (the object was altered) or when the
 * decrypted plaintext does not match the recorded SHA-256 (the record and the
 * object have diverged).
 */
export async function retrieveAndDecrypt(envelope: StoredEnvelope): Promise<Buffer> {
    const keyProvider = getKeyProvider();
    const storage = getObjectStorage();

    const stored = await storage.get(envelope.storageKey);
    if (stored.length < TAG_BYTES) {
        throw new Error('Stored object is too short to contain an authentication tag.');
    }

    const ciphertext = stored.subarray(0, stored.length - TAG_BYTES);
    const authTag = stored.subarray(stored.length - TAG_BYTES);

    const dek = await keyProvider.unwrap(envelope.wrappedKey);

    try {
        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            dek,
            Buffer.from(envelope.iv, 'base64')
        );
        decipher.setAuthTag(authTag);
        const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

        if (envelope.expectedSha256) {
            const actual = crypto.createHash('sha256').update(plaintext).digest('hex');
            if (actual !== envelope.expectedSha256) {
                throw new Error('Decrypted payload does not match the recorded SHA-256 digest.');
            }
        }

        return plaintext;
    } finally {
        dek.fill(0);
    }
}

/** Serialises a wrapped key for the `encrypted_dek` text column. */
export function serialiseWrappedKey(wrapped: WrappedKey): string {
    return `${wrapped.iv}:${wrapped.ciphertext}`;
}

/** Reverses `serialiseWrappedKey`, taking the tag and key id from their columns. */
export function deserialiseWrappedKey(
    encryptedDek: string,
    authTag: string,
    keyId: string
): WrappedKey {
    const separator = encryptedDek.indexOf(':');
    if (separator === -1) {
        throw new Error('Stored key envelope is malformed.');
    }
    return {
        iv: encryptedDek.slice(0, separator),
        ciphertext: encryptedDek.slice(separator + 1),
        authTag,
        keyId,
    };
}

/** Builds the storage key for a record. */
export function buildStorageKey(vaultNumber: string, recordId: string): string {
    return `${vaultNumber}/${recordId}.enc`;
}
