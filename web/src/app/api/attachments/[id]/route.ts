import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helper';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const auth = await getUserFromRequest(req);
    const attachment = await prisma.attachment.findUnique({
        where: { id },
        include: { message: { include: { chat: true } } },
    });

    if (!attachment?.message?.chat) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const chat = attachment.message.chat;
    const hasAccess =
        auth.type === 'authenticated'
            ? chat.user_id === auth.userId
            : chat.guest_token_hash === auth.guestId;
    if (!hasAccess) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin.storage
        .from('attachments')
        .download(attachment.storage_path);
    if (error || !data) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return new Response(data, {
        headers: {
            'Content-Type': attachment.mime_type,
            'Content-Disposition': `inline; filename="${attachment.file_name}"`,
        },
    });
}
