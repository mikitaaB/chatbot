import { NextRequest } from 'next/server';
import { hashGuestToken, getOrCreateGuestSession } from './guest-token';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/service';

export type AuthUser = {
    type: 'authenticated';
    userId: string;
    email?: string;
};

export type GuestUser = {
    type: 'guest';
    guestId: string;
    remainingQuota: number;
    token: string;
};

export type AuthResult = AuthUser | GuestUser;

export async function getUserFromRequest(req: NextRequest): Promise<AuthResult> {
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        const supabase = await createClient();
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (!error && user) {
            return {
                type: 'authenticated',
                userId: user.id,
                email: user.email ?? undefined,
            };
        }
    }

    const guestToken = req.cookies.get('guest_token')?.value;
    if (guestToken) {
        const hash = hashGuestToken(guestToken);
        const { data: session, error } = await supabaseAdmin
            .from('guest_sessions')
            .select('*')
            .eq('guest_token_hash', hash)
            .maybeSingle();

        if (session && !error) {
            return {
                type: 'guest',
                guestId: hash,
                remainingQuota: session.remaining_quota,
                token: guestToken,
            };
        }
    }

    const { session, token } = await getOrCreateGuestSession(guestToken);
    return {
        type: 'guest',
        guestId: session.guest_token_hash,
        remainingQuota: session.remaining_quota,
        token,
    };
}

export function clearGuestCookie(response: Response) {
    response.headers.set(
        'Set-Cookie',
        'guest_token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
    );
}