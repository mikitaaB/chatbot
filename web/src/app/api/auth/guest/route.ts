import { NextResponse } from 'next/server';
import { getOrCreateGuestSession } from '@/lib/guest-token';

export async function POST() {
    const { token, isNew } = await getOrCreateGuestSession();
    const response = NextResponse.json({ success: true, isNew });
    response.cookies.set('guest_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
    });
    return response;
}