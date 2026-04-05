import crypto from 'crypto';
import { prisma } from './prisma';

export function generateGuestToken(): string {
    return crypto.randomUUID();
}

export function hashGuestToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export async function getOrCreateGuestSession(token?: string) {
    if (token) {
        const hash = hashGuestToken(token);
        const session = await prisma.guestSession.findUnique({ where: { guest_token_hash: hash } });
        if (session) {
            return { session, token, isNew: false };
        }
    }
    const newToken = generateGuestToken();
    const hash = hashGuestToken(newToken);
    const session = await prisma.guestSession.create({
        data: { guest_token_hash: hash, remaining_quota: 3 },
    });
    return { session, token: newToken, isNew: true };
}