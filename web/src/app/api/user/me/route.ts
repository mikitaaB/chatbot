import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helper';

export async function GET(req: NextRequest) {
    const auth = await getUserFromRequest(req);
    const response = NextResponse.json(auth);

    if (auth.type === 'guest' && auth.token) {
        response.cookies.set('guest_token', auth.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 30,
        });
    }
    return response;
}