import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helper';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/service';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: chatId } = await params;
    const auth = await getUserFromRequest(req);
    const supabase = await createClient();

    if (auth.type === 'authenticated') {
        const { data: chat, error: fetchError } = await supabase
            .from('chats')
            .select('id')
            .eq('id', chatId)
            .eq('user_id', auth.userId)
            .single();

        if (!chat || fetchError) {
            return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
        }

        const { error: deleteError } = await supabase
            .from('chats')
            .delete()
            .eq('id', chatId);

        if (deleteError) {
            return NextResponse.json({ error: deleteError.message }, { status: 500 });
        }

        return new NextResponse(null, { status: 204 });
    }

    const { data: guestSession, error: sessionError } = await supabaseAdmin
        .from('guest_sessions')
        .select('id')
        .eq('guest_token_hash', auth.guestId)
        .single();

    if (sessionError || !guestSession) {
        return NextResponse.json({ error: 'Guest session not found' }, { status: 404 });
    }

    const { data: chat, error: fetchError } = await supabaseAdmin
        .from('chats')
        .select('id')
        .eq('id', chatId)
        .eq('guest_session_id', guestSession.id)
        .single();

    if (!chat || fetchError) {
        return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const { error: deleteError } = await supabaseAdmin
        .from('chats')
        .delete()
        .eq('id', chatId);

    if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
}