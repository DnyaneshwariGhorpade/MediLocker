import nodemailer, { Transporter } from 'nodemailer';
import { db } from './db';
import { env } from '../config/env';

/**
 * Delivers queued notifications over email and SMS.
 *
 * Without provider credentials configured, delivery is *simulated*: the row is
 * marked `SIMULATED`, never `DELIVERED`. Reporting an undelivered message as
 * delivered would make the notification history untrustworthy, which matters
 * because break-glass alerts are part of the compliance story.
 */

export type DeliveryOutcome =
    | { status: 'DELIVERED'; receipt: string }
    | { status: 'SIMULATED'; receipt: string }
    | { status: 'FAILED'; error: string };

export interface NotificationTransport {
    readonly channel: 'EMAIL' | 'SMS';
    readonly configured: boolean;
    send(to: string, subject: string, body: string): Promise<DeliveryOutcome>;
}

class SmtpEmailTransport implements NotificationTransport {
    readonly channel = 'EMAIL' as const;
    readonly configured: boolean;
    private transporter: Transporter | null = null;

    constructor() {
        this.configured = Boolean(env.smtpHost && env.smtpFrom);
        if (this.configured) {
            this.transporter = nodemailer.createTransport({
                host: env.smtpHost,
                port: env.smtpPort,
                secure: env.smtpPort === 465,
                auth: env.smtpUser ? { user: env.smtpUser, pass: env.smtpPassword } : undefined,
            });
        }
    }

    async send(to: string, subject: string, body: string): Promise<DeliveryOutcome> {
        if (!this.transporter) {
            console.info(`[notify:email:simulated] to=${to} subject="${subject}"`);
            return { status: 'SIMULATED', receipt: 'no-smtp-configured' };
        }

        try {
            const info = await this.transporter.sendMail({
                from: env.smtpFrom,
                to,
                subject,
                text: body,
            });
            return { status: 'DELIVERED', receipt: info.messageId };
        } catch (error: any) {
            return { status: 'FAILED', error: error.message ?? 'SMTP send failed' };
        }
    }
}

class HttpSmsTransport implements NotificationTransport {
    readonly channel = 'SMS' as const;
    readonly configured: boolean;

    constructor() {
        this.configured = Boolean(env.smsApiUrl && env.smsApiKey);
    }

    async send(to: string, _subject: string, body: string): Promise<DeliveryOutcome> {
        if (!this.configured) {
            console.info(`[notify:sms:simulated] to=${to} body="${body.slice(0, 60)}"`);
            return { status: 'SIMULATED', receipt: 'no-sms-provider-configured' };
        }

        try {
            const response = await fetch(env.smsApiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${env.smsApiKey}`,
                },
                body: JSON.stringify({ to, message: body }),
            });

            if (!response.ok) {
                return { status: 'FAILED', error: `SMS provider returned ${response.status}` };
            }

            const payload = (await response.json().catch(() => ({}))) as { id?: string };
            return { status: 'DELIVERED', receipt: payload.id ?? 'accepted' };
        } catch (error: any) {
            return { status: 'FAILED', error: error.message ?? 'SMS send failed' };
        }
    }
}

let transports: Record<'EMAIL' | 'SMS', NotificationTransport> | null = null;

function getTransports() {
    if (!transports) {
        transports = { EMAIL: new SmtpEmailTransport(), SMS: new HttpSmsTransport() };
    }
    return transports;
}

/** Test seam. */
export function setTransports(next: Record<'EMAIL' | 'SMS', NotificationTransport> | null): void {
    transports = next;
}

export interface DeliveryRunResult {
    processed: number;
    delivered: number;
    simulated: number;
    failed: number;
}

const MAX_ATTEMPTS = 5;

/**
 * Drains pending notifications.
 *
 * IN_APP and PUSH have no external transport, so they are marked delivered as
 * soon as the row exists — the notifications screen is the delivery channel.
 */
export async function deliverPending(batchSize = 50): Promise<DeliveryRunResult> {
    const pending = await db.notifications.findMany({
        where: {
            delivery_status: 'PENDING',
            delivery_attempts: { lt: MAX_ATTEMPTS },
        },
        include: { users: { select: { email: true, phone_number: true } } },
        orderBy: { created_at: 'asc' },
        take: batchSize,
    });

    const result: DeliveryRunResult = { processed: 0, delivered: 0, simulated: 0, failed: 0 };

    for (const notification of pending) {
        result.processed += 1;

        if (notification.channel === 'IN_APP' || notification.channel === 'PUSH') {
            await db.notifications.update({
                where: { notification_id: notification.notification_id },
                data: {
                    delivery_status: 'DELIVERED',
                    delivered_at: new Date(),
                    delivery_attempts: { increment: 1 },
                    last_attempt_at: new Date(),
                    provider_receipt: 'in-app',
                },
            });
            result.delivered += 1;
            continue;
        }

        const transport = getTransports()[notification.channel];
        const recipient =
            notification.channel === 'EMAIL'
                ? notification.users.email
                : notification.users.phone_number;

        const outcome = await transport.send(recipient, notification.title, notification.message);

        if (outcome.status === 'FAILED') {
            const attempts = notification.delivery_attempts + 1;
            await db.notifications.update({
                where: { notification_id: notification.notification_id },
                data: {
                    // Give up after MAX_ATTEMPTS so a permanently bad address
                    // does not occupy the queue forever.
                    delivery_status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING',
                    delivery_attempts: attempts,
                    last_attempt_at: new Date(),
                    delivery_error: outcome.error.slice(0, 500),
                },
            });
            result.failed += 1;
            continue;
        }

        await db.notifications.update({
            where: { notification_id: notification.notification_id },
            data: {
                delivery_status: outcome.status,
                delivered_at: new Date(),
                delivery_attempts: { increment: 1 },
                last_attempt_at: new Date(),
                provider_receipt: outcome.receipt.slice(0, 255),
                delivery_error: null,
            },
        });

        if (outcome.status === 'DELIVERED') result.delivered += 1;
        else result.simulated += 1;
    }

    return result;
}

/** Reports which transports are actually wired up. */
export function getTransportStatus() {
    const active = getTransports();
    return {
        email: { configured: active.EMAIL.configured },
        sms: { configured: active.SMS.configured },
    };
}
