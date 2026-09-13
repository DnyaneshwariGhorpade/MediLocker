import crypto from 'crypto';

export const SIGNATURE_ALGORITHM = 'ECDSA-P256-SHA256';

export interface Medication {
    name: string;
    dosage: string;
    frequency: string;
    duration_days?: number;
    instructions?: string;
}

export interface PrescriptionPayload {
    patient_id: string;
    doctor_id: string;
    medications: Medication[];
    clinical_notes?: string;
    issued_at: string;
}

/**
 * Produces the exact byte sequence that is signed and verified.
 *
 * Both sides must agree on this representation or every signature fails, so
 * key order is fixed explicitly rather than left to object literal order, and
 * optional fields are normalised to empty strings.
 */
export function canonicalisePrescription(payload: PrescriptionPayload): string {
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

/** SHA-256 fingerprint of a public key, used to identify the signing key. */
export function fingerprintPublicKey(publicKeyPem: string): string {
    const normalised = publicKeyPem.replace(/\s+/g, '');
    return crypto.createHash('sha256').update(normalised).digest('hex');
}

/**
 * Verifies a base64 signature over the canonical payload against the doctor's
 * registered public key.
 *
 * Returns false rather than throwing for any malformed key or signature: a
 * verification failure and a malformed input are the same outcome to the
 * caller, and neither should surface a crypto library error to a user.
 */
export function verifyPrescriptionSignature(
    payload: PrescriptionPayload,
    signatureBase64: string,
    publicKeyPem: string
): boolean {
    try {
        const key = crypto.createPublicKey(publicKeyPem);
        const data = Buffer.from(canonicalisePrescription(payload), 'utf8');
        const signature = Buffer.from(signatureBase64, 'base64');

        // WebCrypto ECDSA emits raw r||s (P1363); Node expects DER by default.
        return crypto.verify('sha256', data, { key, dsaEncoding: 'ieee-p1363' }, signature);
    } catch {
        return false;
    }
}

/** True when the PEM parses as a public key usable for verification. */
export function isUsablePublicKey(publicKeyPem: string): boolean {
    try {
        const key = crypto.createPublicKey(publicKeyPem);
        return key.type === 'public';
    } catch {
        return false;
    }
}
