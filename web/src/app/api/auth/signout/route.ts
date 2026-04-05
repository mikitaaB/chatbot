import { NextResponse } from 'next/server';
import { clearGuestCookie } from '@/lib/auth-helper';

export async function POST() {
    const response = NextResponse.json({ success: true });
    clearGuestCookie(response);
    return response;
}