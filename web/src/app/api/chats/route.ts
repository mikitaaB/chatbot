import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helper';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/service';

export async function GET(req: NextRequest) {
    const auth = await getUserFromRequest(req);
    const supabase = await createClient();

    if (auth.type === 'authenticated') {
        const { data: chats, error } = await supabase
            .from('chats')
            .select(`
                *,
                messages (
                    *,
                    attachments (*)
                )
            `)
            .eq('user_id', auth.userId)
            .order('updated_at', { ascending: false });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        const chatsWithLastMessage = chats?.map(chat => ({
            ...chat,
            messages: chat.messages?.slice(0, 1) || []
        })) || [];

        return NextResponse.json(chatsWithLastMessage);
    }

    if (!auth.guestId) {
        return NextResponse.json({ error: 'Guest token required' }, { status: 401 });
    }

    const { data: guestSession, error: sessionError } = await supabaseAdmin
        .from('guest_sessions')
        .select('id')
        .eq('guest_token_hash', auth.guestId)
        .maybeSingle();

    if (sessionError || !guestSession) {
        console.error(`Guest session not found for token: ${auth.guestId}`);
        return NextResponse.json({ error: 'Invalid guest token' }, { status: 401 });
    }

    const { data: chats, error } = await supabaseAdmin
        .from('chats')
        .select(`
            *,
            messages (
                *,
                attachments (*)
            )
        `)
        .is('user_id', null)
        .eq('guest_session_id', guestSession.id)
        .order('updated_at', { ascending: false });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const chatsWithLastMessage = chats?.map(chat => ({
        ...chat,
        messages: chat.messages?.slice(0, 1) || []
    })) || [];

    return NextResponse.json(chatsWithLastMessage);
}

export async function POST(req: NextRequest) {
    const auth = await getUserFromRequest(req);
    const supabase = await createClient();
    const { title } = await req.json();

    if (auth.type === 'authenticated') {
        const { data: chat, error } = await supabase
            .from('chats')
            .insert({
                title: title || 'New chat',
                user_id: auth.userId,
            })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(chat, { status: 201 });
    }

    const { data: guestSession, error: sessionError } = await supabaseAdmin
        .from('guest_sessions')
        .select('id')
        .eq('guest_token_hash', auth.guestId)
        .single();

    if (sessionError || !guestSession) {
        return NextResponse.json({ error: 'Guest session not found' }, { status: 404 });
    }

    const { data: chat, error } = await supabaseAdmin
        .from('chats')
        .insert({
            title: title || 'New chat',
            guest_session_id: guestSession.id,
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(chat, { status: 201 });
}
