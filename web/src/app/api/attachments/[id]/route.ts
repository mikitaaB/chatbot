import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helper';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/service';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const auth = await getUserFromRequest(req);
    const supabase = await createClient();

    const dbClient = auth.type === 'authenticated' ? supabase : supabaseAdmin;

    const { data: attachment, error } = await dbClient
        .from('attachments')
        .select(`
            *,
            messages (
                chat_id,
                chats (
                    user_id,
                    guest_session_id
                )
            )
        `)
        .eq('id', id)
        .maybeSingle();

    if (error || !attachment?.messages) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const chat = attachment.messages.chats;
    let hasAccess = false;

    if (auth.type === 'authenticated') {
        hasAccess = chat.user_id === auth.userId;
    } else {
        hasAccess = chat.guest_session_id !== null;
        if (hasAccess && auth.guestId) {
            const { data: guestSession } = await supabaseAdmin
                .from('guest_sessions')
                .select('id')
                .eq('guest_token_hash', auth.guestId)
                .maybeSingle();
            hasAccess = guestSession?.id === chat.guest_session_id;
        }
    }

    if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error: downloadError } = await dbClient.storage
        .from('attachments')
        .download(attachment.storage_path);

    if (downloadError || !data) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return new Response(data, {
        headers: {
            'Content-Type': attachment.mime_type,
            'Content-Disposition': `inline; filename="${attachment.file_name}"`,
        },
    });
}