import crypto from 'crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { agent, db, login, seedFixtures } from './helpers';
import { getObjectStorage } from '../src/services/objectStorage';

let fixtures: Awaited<ReturnType<typeof seedFixtures>>;
let patientToken: string;
let doctorToken: string;

const createdRecordIds: string[] = [];
const createdConsentIds: string[] = [];

/** A small but genuine PDF, so the MIME allowlist is exercised honestly. */
const PDF_BYTES = Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
        '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
        '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\n' +
        'trailer<</Root 1 0 R>>\n%%EOF\n',
    'utf8'
);

const PDF_SHA256 = crypto.createHash('sha256').update(PDF_BYTES).digest('hex');

beforeAll(async () => {
    fixtures = await seedFixtures();
    patientToken = await login(fixtures.patient.users.email);
    doctorToken = await login(fixtures.doctor.users.email);
});

afterAll(async () => {
    if (createdConsentIds.length > 0) {
        await db.consents.deleteMany({ where: { consent_id: { in: createdConsentIds } } });
    }
    for (const recordId of createdRecordIds) {
        const record = await db.medical_records.findUnique({ where: { record_id: recordId } });
        if (record) {
            await db.blockchain_anchors.deleteMany({ where: { record_id: recordId } });
            await db.medical_records.delete({ where: { record_id: recordId } }).catch(() => undefined);
            await getObjectStorage().delete(record.file_s3_key).catch(() => undefined);
        }
    }
    await db.$disconnect();
});

async function uploadPdf(token: string, title = 'Integration Test Report') {
    const response = await agent()
        .post('/api/v1/vault/upload')
        .set('Authorization', `Bearer ${token}`)
        .field('vault_number', fixtures.vault.vault_number)
        .field('record_title', title)
        .field('category', 'BLOOD_REPORT')
        .field('tags', 'integration,test')
        .attach('file', PDF_BYTES, { filename: 'report.pdf', contentType: 'application/pdf' });

    if (response.status === 201) createdRecordIds.push(response.body.record.record_id);
    return response;
}

describe('encrypted file pipeline', () => {
    it('encrypts an uploaded file and computes the digest server-side', async () => {
        const response = await uploadPdf(doctorToken);

        expect(response.status).toBe(201);
        // The digest is derived from the received bytes, not supplied by the client.
        expect(response.body.sha256).toBe(PDF_SHA256);
        expect(response.body.record.storage_driver).toBe('LOCAL');
        expect(response.body.record.encryption_algorithm).toBe('AES-256-GCM');
    });

    it('stores ciphertext, not the original bytes', async () => {
        const recordId = createdRecordIds[0]!;
        const record = await db.medical_records.findUnique({ where: { record_id: recordId } });
        const stored = await getObjectStorage().get(record!.file_s3_key);

        // A PDF starts with %PDF; the stored object must not.
        expect(stored.subarray(0, 4).toString('utf8')).not.toBe('%PDF');
        expect(stored.equals(PDF_BYTES)).toBe(false);
        // Ciphertext plus a 16-byte GCM tag.
        expect(stored.length).toBe(PDF_BYTES.length + 16);
    });

    it('returns the original bytes to the owning patient', async () => {
        const recordId = createdRecordIds[0]!;
        const response = await agent()
            .post(`/api/v1/vault/records/${recordId}/decrypt`)
            .set('Authorization', `Bearer ${patientToken}`);

        expect(response.status).toBe(200);
        const roundTripped = Buffer.from(response.body.content_base64, 'base64');
        expect(roundTripped.equals(PDF_BYTES)).toBe(true);
        expect(response.body.file_sha256_hash).toBe(PDF_SHA256);
    });

    it('refuses a doctor with no consent', async () => {
        if (!fixtures.otherDoctor || fixtures.otherDoctor.doctor_id === fixtures.doctor.doctor_id) return;

        const otherToken = await login(fixtures.otherDoctor.users.email);
        const response = await agent()
            .post(`/api/v1/vault/records/${createdRecordIds[0]}/decrypt`)
            .set('Authorization', `Bearer ${otherToken}`);

        expect(response.status).toBe(403);
    });

    it('refuses a doctor whose consent blocks the category', async () => {
        const granted = await agent()
            .post('/api/v1/consent/grant')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({
                doctor_id: fixtures.doctor.doctor_id,
                allowed_categories: ['PRESCRIPTION'],
                blocked_categories: ['BLOOD_REPORT'],
                valid_until: new Date(Date.now() + 86_400_000).toISOString(),
            });
        expect(granted.status).toBe(201);
        createdConsentIds.push(granted.body.consent_id);

        // The record is a BLOOD_REPORT, which this consent blocks.
        const response = await agent()
            .post(`/api/v1/vault/records/${createdRecordIds[0]}/decrypt`)
            .set('Authorization', `Bearer ${doctorToken}`);

        expect(response.status).toBe(403);
    });

    it('allows download for the owning patient and names the file', async () => {
        const response = await agent()
            .get(`/api/v1/vault/records/${createdRecordIds[0]}/download`)
            .set('Authorization', `Bearer ${patientToken}`);

        expect(response.status).toBe(200);
        expect(response.headers['content-disposition']).toContain('report.pdf');
        expect(Buffer.from(response.body).equals(PDF_BYTES)).toBe(true);
    });

    it('keeps a block in force even when a later grant allows the category', async () => {
        // The blocking consent from the previous test is still active. Adding a
        // broader grant must not silently unblock the category, which is what
        // the consent screen promises the patient.
        const broadened = await agent()
            .post('/api/v1/consent/grant')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({
                doctor_id: fixtures.doctor.doctor_id,
                allowed_categories: ['BLOOD_REPORT'],
                blocked_categories: [],
                valid_until: new Date(Date.now() + 86_400_000).toISOString(),
            });
        expect(broadened.status).toBe(201);
        createdConsentIds.push(broadened.body.consent_id);

        const response = await agent()
            .post(`/api/v1/vault/records/${createdRecordIds[0]}/decrypt`)
            .set('Authorization', `Bearer ${doctorToken}`);
        expect(response.status).toBe(403);
    });

    it('refuses download to a doctor holding only read-only consent', async () => {
        // Clear the blocking consent so this test measures access level alone.
        await db.consents.updateMany({
            where: { patient_id: fixtures.patient.patient_id, doctor_id: fixtures.doctor.doctor_id },
            data: { consent_status: 'REVOKED', revoked_at: new Date() },
        });

        const granted = await agent()
            .post('/api/v1/consent/grant')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({
                doctor_id: fixtures.doctor.doctor_id,
                allowed_categories: ['BLOOD_REPORT'],
                blocked_categories: [],
                valid_until: new Date(Date.now() + 86_400_000).toISOString(),
                access_level: 'READ_ONLY',
            });
        expect(granted.status).toBe(201);
        createdConsentIds.push(granted.body.consent_id);

        // Viewing is permitted...
        const view = await agent()
            .post(`/api/v1/vault/records/${createdRecordIds[0]}/decrypt`)
            .set('Authorization', `Bearer ${doctorToken}`);
        expect(view.status).toBe(200);

        // ...but taking a copy is not.
        const download = await agent()
            .get(`/api/v1/vault/records/${createdRecordIds[0]}/download`)
            .set('Authorization', `Bearer ${doctorToken}`);
        expect(download.status).toBe(403);
    });

    it('does not let a search query reach a blocked category', async () => {
        await db.consents.updateMany({
            where: { patient_id: fixtures.patient.patient_id, doctor_id: fixtures.doctor.doctor_id },
            data: { consent_status: 'REVOKED', revoked_at: new Date() },
        });

        const granted = await agent()
            .post('/api/v1/consent/grant')
            .set('Authorization', `Bearer ${patientToken}`)
            .send({
                doctor_id: fixtures.doctor.doctor_id,
                allowed_categories: ['PRESCRIPTION'],
                blocked_categories: ['HIV_REPORT'],
                valid_until: new Date(Date.now() + 86_400_000).toISOString(),
            });
        expect(granted.status).toBe(201);
        createdConsentIds.push(granted.body.consent_id);

        // Naming the blocked category in the query previously replaced the
        // consent filter outright.
        const response = await agent()
            .get(`/api/v1/doctor/records/search?vault_number=${fixtures.vault.vault_number}&category=HIV_REPORT`)
            .set('Authorization', `Bearer ${doctorToken}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual([]);
    });

    it('detects a tampered stored object instead of returning corrupt data', async () => {
        const upload = await uploadPdf(doctorToken, 'Tamper Test');
        expect(upload.status).toBe(201);

        const recordId = upload.body.record.record_id;
        const record = await db.medical_records.findUnique({ where: { record_id: recordId } });
        const storage = getObjectStorage();

        const original = await storage.get(record!.file_s3_key);
        const tampered = Buffer.from(original);
        tampered[0] = tampered[0]! ^ 0xff;
        await storage.put(record!.file_s3_key, tampered);

        // The GCM tag no longer verifies, so decryption fails rather than
        // silently returning altered bytes.
        const response = await agent()
            .post(`/api/v1/vault/records/${recordId}/decrypt`)
            .set('Authorization', `Bearer ${patientToken}`);
        expect(response.status).toBe(500);

        await storage.put(record!.file_s3_key, original);
    });

    it('rejects a disallowed file type', async () => {
        const response = await agent()
            .post('/api/v1/vault/upload')
            .set('Authorization', `Bearer ${doctorToken}`)
            .field('vault_number', fixtures.vault.vault_number)
            .field('record_title', 'Executable')
            .field('category', 'BLOOD_REPORT')
            .attach('file', Buffer.from('MZ binary'), { filename: 'evil.exe', contentType: 'application/x-msdownload' });

        expect(response.status).toBe(400);
    });

    it('anchors using the stored digest, not a client-supplied one', async () => {
        const recordId = createdRecordIds[0]!;

        const response = await agent()
            .post('/api/v1/vault/anchor-blockchain')
            .set('Authorization', `Bearer ${patientToken}`)
            // A caller-supplied digest is not part of the schema and is ignored.
            .send({ record_id: recordId, document_sha256: 'f'.repeat(64) });

        expect([201, 409]).toContain(response.status);
        if (response.status === 201) {
            expect(response.body.anchor.document_sha256).toBe(PDF_SHA256);
            // Committed to the append-only ledger (task P5-08), so the anchor
            // is confirmed and carries a real chained entry hash.
            expect(response.body.anchor.anchor_status).toBe('CONFIRMED');
            expect(response.body.ledger.entry_hash).toMatch(/^[a-f0-9]{64}$/);
        }
    });

    it('reports pre-pipeline records as unretrievable rather than pretending', async () => {
        const legacy = await db.medical_records.create({
            data: {
                vault_id: fixtures.vault.vault_id,
                patient_id: fixtures.patient.patient_id,
                record_title: 'Legacy mock record',
                category: 'BLOOD_REPORT',
                file_s3_key: 's3://mock-bucket/legacy.pdf',
                file_mime_type: 'application/pdf',
                file_size_bytes: BigInt(1024),
                file_sha256_hash: 'a'.repeat(64),
                kms_key_id: 'mock_kms_key_id_123',
                encrypted_dek: 'mock_dek',
                iv_bytes: 'mock_iv',
                storage_driver: 'MOCK',
            },
        });
        createdRecordIds.push(legacy.record_id);

        const response = await agent()
            .post(`/api/v1/vault/records/${legacy.record_id}/decrypt`)
            .set('Authorization', `Bearer ${patientToken}`);

        expect(response.status).toBe(409);
        expect(response.body.message).toContain('predates');
    });
});
