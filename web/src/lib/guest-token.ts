import crypto from 'node:crypto';
import { supabaseAdmin } from '@/utils/supabase/service';

export function generateGuestToken(): string {
    return crypto.randomUUID();
}

export function hashGuestToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export async function getOrCreateGuestSession(token?: string) {
    if (token) {
        const hash = hashGuestToken(token);
        const { data: session, error } = await supabaseAdmin
            .from('guest_sessions')
            .select('*')
            .eq('guest_token_hash', hash)
            .maybeSingle();

        if (session && !error) {
            return { session, token, isNew: false };
        }

        console.warn(`Guest token in cookie not found in DB, will create new session`);
    }

    const newToken = generateGuestToken();
    const hash = hashGuestToken(newToken);

    const { data: session, error } = await supabaseAdmin
        .from('guest_sessions')
        .upsert({ guest_token_hash: hash, remaining_quota: 3 }, { onConflict: 'guest_token_hash' })
        .select()
        .single();

    if (error) {
        throw new Error(`Failed to create guest session: ${error.message}`);
    }

    return { session, token: newToken, isNew: true };
}