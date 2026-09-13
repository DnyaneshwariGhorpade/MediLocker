/**
 * Browser-side cryptography.
 *
 * The doctor's signing key is generated here and marked non-extractable, so it
 * cannot be read back out by page script and never reaches the server. Only
 * the public key is transmitted.
 */

const DB_NAME = 'medilocker-keys';
const STORE_NAME = 'signing-keys';
const KEY_ID = 'doctor-signing-key';

/** SHA-256 of a file, computed locally. The file itself never leaves the device. */
export async function sha256Hex(data: ArrayBuffer | Uint8Array): Promise<string> {
    const buffer = data instanceof Uint8Array ? (data.buffer as ArrayBuffer) : data;
    const digest = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

export async function sha256File(file: File): Promise<string> {
    return sha256Hex(await file.arrayBuffer());
}

// --------------------------------------------------------------- key storage

function openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE_NAME)) {
                request.result.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function putKey(value: CryptoKeyPair): Promise<void> {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(value, KEY_ID);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
}

async function readKey(): Promise<CryptoKeyPair | undefined> {
    const db = await openDatabase();
    const result = await new Promise<CryptoKeyPair | undefined>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(KEY_ID);
        request.onsuccess = () => resolve(request.result as CryptoKeyPair | undefined);
        request.onerror = () => reject(request.error);
    });
    db.close();
    return result;
}

export async function hasSigningKey(): Promise<boolean> {
    try {
        return (await readKey()) !== undefined;
    } catch {
        return false;
    }
}

// ------------------------------------------------------------- key material

function toPem(der: ArrayBuffer, label: 'PUBLIC KEY' | 'PRIVATE KEY'): string {
    const base64 = btoa(String.fromCharCode(...new Uint8Array(der)));
    const lines = base64.match(/.{1,64}/g) ?? [];
    return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}

/**
 * Creates the doctor's ECDSA P-256 key pair and persists it locally.
 *
 * `extractable: false` on the pair means the private key can be used to sign
 * but never exported — losing the device means losing the key, which is the
 * intended trade-off for a signing credential.
 */
export async function generateSigningKeyPair(): Promise<{ publicKeyPem: string }> {
    const keyPair = await crypto.subtle.generateKey(
        { name: 'ECDSA', namedCurve: 'P-256' },
        false,
        ['sign', 'verify']
    );

    const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
    await putKey(keyPair);

    return { publicKeyPem: toPem(spki, 'PUBLIC KEY') };
}

/**
 * Signs a canonical payload with the locally held private key.
 * Returns a base64 signature in IEEE P1363 (raw r||s) form, which is what
 * WebCrypto emits and what the server is configured to verify.
 */
export async function signPayload(canonicalJson: string): Promise<string> {
    const keyPair = await readKey();
    if (!keyPair) {
        throw new Error(
            'No signing key is present on this device. Register a signing key before issuing prescriptions.'
        );
    }

    const signature = await crypto.subtle.sign(
        { name: 'ECDSA', hash: 'SHA-256' },
        keyPair.privateKey,
        new TextEncoder().encode(canonicalJson)
    );

    return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export interface Medication {
    name: string;
    dosage: string;
    frequency: string;
    duration_days?: number;
    instructions?: string;
}

/**
 * Must produce byte-identical output to `canonicalisePrescription` on the
 * server. Any divergence makes every signature fail verification.
 */
export function canonicalisePrescription(payload: {
    patient_id: string;
    doctor_id: string;
    medications: Medication[];
    clinical_notes?: string;
    issued_at: string;
}): string {
    return JSON.stringify({
        patient_id: payload.patient_id,
        doctor_id: payload.doctor_id,
        issued_at: payload.issued_at,
        clinical_notes: payload.clinical_notes ?? '',
        medications: payload.medications.map((medication) => ({
            name: medication.name,
            dosage: medication.dosage,
            frequency: medication.frequency,
            duration_days: medication.duration_days ?? 0,
            instructions: medication.instructions ?? '',
        })),
    });
}
