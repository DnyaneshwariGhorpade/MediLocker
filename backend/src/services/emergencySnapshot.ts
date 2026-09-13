import { db } from './db';

interface RecordSummary {
    record_id: string;
    record_title: string;
    category: string;
    diagnosis: string | null;
    record_date: Date;
}

export interface EmergencySnapshot {
    bloodGroup: string | null;
    allergies: RecordSummary[];
    chronicConditions: RecordSummary[];
    activeMedications: Array<{
        name: string;
        dosage: string;
        frequency: string;
        prescribed_by: string;
        issued_at: Date;
    }>;
    derived: true;
    /** Explains what an empty list does and does not mean. */
    caveat: string;
    sources: {
        allergyRecords: number;
        chronicRecords: number;
        activePrescriptions: number;
    };
}

/**
 * Builds the critical-information panel shown at the top of the break-glass
 * viewer (Screen 6.2).
 *
 * Everything is derived from the patient's own records. An empty list means
 * MediLocker holds no such record — not that the patient has no allergies.
 * That distinction is surfaced explicitly, because a clinician reading
 * "Allergies: none" in an emergency would reasonably act on it.
 */
export async function buildEmergencySnapshot(
    patientId: string,
    bloodGroup: string | null,
    records: RecordSummary[]
): Promise<EmergencySnapshot> {
    const allergies = records.filter((record) => record.category === 'ALLERGY_RECORD');
    const chronicConditions = records.filter(
        (record) => record.category === 'CHRONIC_DISEASE_HISTORY'
    );

    // Prescriptions still inside their validity window, most recent first.
    const now = new Date();
    const prescriptions = await db.prescriptions.findMany({
        where: {
            patient_id: patientId,
            is_signature_valid: true,
            OR: [{ valid_until: null }, { valid_until: { gte: now } }],
        },
        include: { doctors: { select: { first_name: true, last_name: true } } },
        orderBy: { issued_at: 'desc' },
        take: 20,
    });

    const activeMedications: EmergencySnapshot['activeMedications'] = [];

    for (const prescription of prescriptions) {
        const medications = (prescription.medications ?? []) as unknown as Array<{
            name?: string;
            dosage?: string;
            frequency?: string;
        }>;

        for (const medication of medications) {
            if (!medication?.name) continue;
            activeMedications.push({
                name: medication.name,
                dosage: medication.dosage ?? '',
                frequency: medication.frequency ?? '',
                prescribed_by: `Dr. ${prescription.doctors.first_name} ${prescription.doctors.last_name}`,
                issued_at: prescription.issued_at,
            });
        }
    }

    return {
        bloodGroup,
        allergies,
        chronicConditions,
        activeMedications,
        derived: true,
        caveat:
            'Derived from records held by MediLocker. An empty list means no such record exists here, ' +
            'not that the patient has none. Confirm clinically where possible.',
        sources: {
            allergyRecords: allergies.length,
            chronicRecords: chronicConditions.length,
            activePrescriptions: prescriptions.length,
        },
    };
}
