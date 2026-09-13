import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { toDataURL } from 'qrcode';
import { Medication } from './prescriptionSignature';

export interface PrescriptionPdfInput {
    prescriptionId: string;
    issuedAt: Date;
    validUntil?: Date | null;
    doctorName: string;
    doctorMrn: string;
    doctorSpecialisation: string;
    hospitalName: string;
    patientName: string;
    patientVaultNumber: string;
    medications: Medication[];
    clinicalNotes?: string | null;
    verifyUrl: string;
}

const MARGIN = 50;
const NAVY = rgb(0.12, 0.23, 0.54);
const SLATE = rgb(0.2, 0.25, 0.33);
const GREY = rgb(0.45, 0.5, 0.58);

/**
 * Renders a signed prescription as a PDF carrying a QR code that resolves to
 * the public verifier, so a pharmacy can check authenticity without an account.
 */
export async function renderPrescriptionPdf(input: PrescriptionPdfInput): Promise<Buffer> {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]); // A4
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const { width, height } = page.getSize();
    let y = height - MARGIN;

    const line = (text: string, size = 10, font = regular, colour = SLATE, indent = 0) => {
        page.drawText(text, { x: MARGIN + indent, y, size, font, color: colour });
        y -= size + 6;
    };

    // Header
    page.drawText('MediLocker', { x: MARGIN, y, size: 22, font: bold, color: NAVY });
    y -= 26;
    page.drawText('Digitally Signed Prescription', { x: MARGIN, y, size: 12, font: bold, color: SLATE });
    y -= 22;

    page.drawLine({
        start: { x: MARGIN, y },
        end: { x: width - MARGIN, y },
        thickness: 1,
        color: rgb(0.8, 0.84, 0.9),
    });
    y -= 22;

    // Prescriber and patient
    line('PRESCRIBER', 9, bold, GREY);
    line(input.doctorName, 12, bold);
    line(`${input.doctorSpecialisation}  |  MRN ${input.doctorMrn}`);
    line(input.hospitalName);
    y -= 8;

    line('PATIENT', 9, bold, GREY);
    line(input.patientName, 12, bold);
    line(`Vault ${input.patientVaultNumber}`);
    y -= 8;

    line('ISSUED', 9, bold, GREY);
    line(input.issuedAt.toISOString().slice(0, 16).replace('T', ' ') + ' UTC');
    if (input.validUntil) {
        line(`Valid until ${input.validUntil.toISOString().slice(0, 10)}`);
    }
    y -= 12;

    // Medications
    line('MEDICATIONS', 9, bold, GREY);
    y -= 2;

    input.medications.forEach((medication, index) => {
        line(`${index + 1}. ${medication.name}  ${medication.dosage}`, 11, bold);
        const detail = [
            medication.frequency,
            medication.duration_days ? `${medication.duration_days} day(s)` : null,
            medication.instructions || null,
        ]
            .filter(Boolean)
            .join('  •  ');
        if (detail) line(detail, 10, regular, GREY, 14);
        y -= 4;
    });

    if (input.clinicalNotes) {
        y -= 8;
        line('NOTES', 9, bold, GREY);
        // Crude wrap; the notes field is capped at 5000 characters upstream.
        for (const chunk of input.clinicalNotes.match(/.{1,88}/g) ?? []) {
            line(chunk, 10);
        }
    }

    // Verification block
    const qrDataUrl = await toDataURL(input.verifyUrl, { margin: 1, width: 220 });
    const qrImage = await pdf.embedPng(Buffer.from(qrDataUrl.split(',')[1] ?? '', 'base64'));
    const qrSize = 110;

    page.drawImage(qrImage, {
        x: width - MARGIN - qrSize,
        y: MARGIN + 26,
        width: qrSize,
        height: qrSize,
    });

    page.drawText('Scan to verify authenticity', {
        x: width - MARGIN - qrSize - 4,
        y: MARGIN + 12,
        size: 8,
        font: regular,
        color: GREY,
    });

    page.drawText('Digitally signed. Any alteration invalidates the signature.', {
        x: MARGIN,
        y: MARGIN + 40,
        size: 9,
        font: bold,
        color: NAVY,
    });
    page.drawText(`Prescription ID: ${input.prescriptionId}`, {
        x: MARGIN,
        y: MARGIN + 26,
        size: 8,
        font: regular,
        color: GREY,
    });
    page.drawText(input.verifyUrl, {
        x: MARGIN,
        y: MARGIN + 14,
        size: 8,
        font: regular,
        color: GREY,
    });

    return Buffer.from(await pdf.save());
}
