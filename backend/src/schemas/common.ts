import { z } from 'zod';

export const RECORD_CATEGORIES = [
    'PRESCRIPTION',
    'BLOOD_REPORT',
    'X_RAY',
    'MRI',
    'CT_SCAN',
    'VACCINATION_RECORD',
    'ALLERGY_RECORD',
    'SURGERY_HISTORY',
    'DISCHARGE_SUMMARY',
    'CHRONIC_DISEASE_HISTORY',
    'PSYCHIATRIC_REPORT',
    'HIV_REPORT',
] as const;

export const FLAG_REASONS = [
    'INCORRECT_INFO',
    'DUPLICATE',
    'WRONG_PRESCRIPTION',
    'ILLEGIBLE',
    'EXPIRED',
    'MISSING_PAGES',
    'OTHER',
] as const;

export const FLAG_STATUSES = ['NORMAL', 'FLAGGED', 'UNDER_REVIEW', 'RESOLVED'] as const;

export const HOSPITAL_TYPES = [
    'GOVERNMENT',
    'PRIVATE_HOSPITAL',
    'CLINIC',
    'DIAGNOSTIC_LAB',
    'MULTI_SPECIALTY',
] as const;

export const uuid = z.string().uuid('Must be a valid UUID');
export const idParam = z.object({ id: uuid });

export const email = z.string().trim().toLowerCase().email('Must be a valid email address').max(255);

export const phone = z
    .string()
    .trim()
    .regex(/^[0-9+][0-9\s-]{7,19}$/, 'Must be a valid phone number')
    .max(20);

/**
 * Registration passwords must survive a credential-stuffing attempt. Mirrors
 * the rule stated on Screen 2.2 of the feature map.
 */
export const password = z
    .string()
    .min(12, 'Password must be at least 12 characters')
    .max(128)
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a digit')
    .regex(/[^A-Za-z0-9]/, 'Password must contain a symbol');

export const sha256Hex = z.string().regex(/^[a-fA-F0-9]{64}$/, 'Must be a 64-character SHA-256 hex digest');

export const isoDate = z.coerce.date();

/** Future timestamp, used for consent and session expiry. */
export const futureDate = z.coerce.date().refine((value) => value.getTime() > Date.now(), {
    message: 'Must be in the future',
});

export const categoryList = z.array(z.enum(RECORD_CATEGORIES));

export const shortText = (max = 255) => z.string().trim().min(1).max(max);
export const longText = (max = 5000) => z.string().trim().min(1).max(max);

export const pagination = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
});
