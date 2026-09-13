import { Request, Response } from 'express';
import { db } from '../services/db';
import { findByPayload } from '../services/ledger';
import {
    canonicalisePrescription,
    Medication,
    verifyPrescriptionSignature,
} from '../services/prescriptionSignature';

/**
 * POST /api/v1/public/verify-prescription
 *
 * Re-canonicalises a stored prescription and verifies its recorded signature
 * against the issuing doctor's registered public key. No login required — a
 * pharmacy scans the QR code and lands here.
 *
 * This replaces the previous behaviour, which ignored its input entirely and
 * returned the first prescription in the table as valid.
 */
export const verifyPrescription = async (req: Request, res: Response): Promise<void> => {
    const { prescription_id } = req.body;

    if (!prescription_id) {
        res.status(400).json({
            verified: false,
            message: 'Provide the prescription id printed on the document, or scan its QR code.',
        });
        return;
    }

    const prescription = await db.prescriptions.findUnique({
        where: { prescription_id },
        include: {
            doctors: { include: { hospitals: true } },
            patients: { select: { first_name: true, last_name: true } },
        },
    });

    if (!prescription) {
        res.status(404).json({
            verified: false,
            message: 'No prescription exists with that identifier.',
        });
        return;
    }

    const medications = (prescription.medications ?? []) as unknown as Medication[];

    const payload = {
        patient_id: prescription.patient_id,
        doctor_id: prescription.doctor_id,
        medications,
        clinical_notes: prescription.clinical_notes ?? '',
        issued_at: prescription.issued_at.toISOString(),
    };

    const signatureValid = verifyPrescriptionSignature(
        payload,
        prescription.digital_signature,
        prescription.doctors.public_key_pem
    );

    // A stored record that no longer verifies means the row was altered after
    // signing. Flag it rather than quietly reporting failure.
    if (!signatureValid && prescription.is_signature_valid !== false) {
        await db.prescriptions.update({
            where: { prescription_id },
            data: { is_signature_valid: false },
        });
    }

    const expired = prescription.valid_until !== null && prescription.valid_until < new Date();

    res.status(signatureValid ? 200 : 409).json({
        verified: signatureValid,
        message: signatureValid
            ? expired
                ? 'Signature is valid, but this prescription has expired.'
                : 'Signature is valid. This prescription is authentic and unaltered.'
            : 'Signature verification FAILED. This document does not match what was signed.',
        expired,
        details: {
            prescription_id: prescription.prescription_id,
            doctor_name: `Dr. ${prescription.doctors.first_name} ${prescription.doctors.last_name}`,
            mrn: prescription.doctors.mrn,
            doctor_verification_status: prescription.doctors.verification_status,
            hospital: prescription.doctors.hospitals?.hospital_name ?? 'Independent Clinic',
            // Patient identity is minimised: enough to match the paper copy,
            // not enough to enumerate patients.
            patient_initials: `${prescription.patients.first_name.charAt(0)}${prescription.patients.last_name.charAt(0)}`,
            issued_at: prescription.issued_at,
            valid_until: prescription.valid_until,
            signature_algorithm: prescription.signature_algorithm,
            medication_count: medications.length,
        },
        // Lets an integrator confirm they are verifying the same bytes.
        canonical_payload_sha256_input_length: canonicalisePrescription(payload).length,
    });
};

/**
 * POST /api/v1/public/verify-hash
 *
 * Checks a document digest against the anchor ledger. The client computes the
 * SHA-256 locally, so the document itself never leaves the device.
 */
export const verifyHash = async (req: Request, res: Response): Promise<void> => {
    const { sha256_hash } = req.body;

    // Several records can share a digest (identical documents), and older rows
    // may predate the ledger. Prefer the most recent confirmed anchor so the
    // answer does not depend on arbitrary row order.
    const anchor =
        (await db.blockchain_anchors.findFirst({
            where: { document_sha256: sha256_hash.toLowerCase(), anchor_status: 'CONFIRMED' },
            include: {
                medical_records: { select: { record_title: true, category: true, record_date: true } },
            },
            orderBy: { created_at: 'desc' },
        })) ??
        (await db.blockchain_anchors.findFirst({
            where: { document_sha256: sha256_hash.toLowerCase() },
            include: {
                medical_records: { select: { record_title: true, category: true, record_date: true } },
            },
            orderBy: { created_at: 'desc' },
        }));

    if (!anchor) {
        // Also report whether the digest matches a stored record that simply
        // has not been anchored yet, which is a meaningfully different answer.
        const record = await db.medical_records.findFirst({
            where: { file_sha256_hash: sha256_hash.toLowerCase() },
            select: { record_title: true, record_date: true },
        });

        res.json({
            verified: false,
            anchored: false,
            known_record: record !== null,
            message: record
                ? 'This document matches a stored record, but it has not been anchored yet.'
                : 'This document digest is not known to MediLocker.',
            ...(record ? { details: { record_title: record.record_title, record_date: record.record_date } } : {}),
        });
        return;
    }

    // Cross-check against the ledger entry itself, so a rewritten anchor row
    // cannot report a confirmation the ledger does not contain.
    const ledgerEntry = await findByPayload(sha256_hash);
    const ledgerConfirms = ledgerEntry !== null && ledgerEntry.payload_sha256 === anchor.document_sha256;

    res.json({
        verified: anchor.anchor_status === 'CONFIRMED' && ledgerConfirms,
        anchored: true,
        anchor_status: anchor.anchor_status,
        ledger_confirmed: ledgerConfirms,
        message:
            anchor.anchor_status === 'CONFIRMED' && ledgerConfirms
                ? 'Document digest is confirmed in the integrity ledger and has not been altered.'
                : ledgerConfirms
                  ? 'Document digest is recorded and matches, but confirmation is still pending.'
                  : 'An anchor row exists but the integrity ledger does not confirm it. Treat with suspicion.',
        details: {
            blockchain_network: anchor.blockchain_network,
            channel_name: anchor.channel_name,
            block_number: anchor.block_number?.toString() ?? null,
            transaction_tx_id: anchor.transaction_tx_id,
            record_title: anchor.medical_records.record_title,
            record_date: anchor.medical_records.record_date,
            anchored_at: anchor.created_at,
            ledger_entry_id: ledgerEntry?.entry_id.toString() ?? null,
            ledger_entry_hash: ledgerEntry?.entry_hash ?? null,
        },
    });
};
