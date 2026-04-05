import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helper';
import { supabaseAdmin } from '@/lib/supabase-admin';

const allowedMimeTypes = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain',
    'text/markdown',
    'text/javascript',
    'application/json',
]);

export async function POST(req: NextRequest) {
    const auth = await getUserFromRequest(req);
    const formData = await req.formData();
    const file = formData.get('file') as File;
    if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!allowedMimeTypes.has(file.type)) {
        return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 });
    }

    const ownerId = auth.type === 'authenticated' ? `user_${auth.userId}` : `guest_${auth.guestId}`;
    const filePath = `${ownerId}/${Date.now()}_${file.name.replaceAll(/[^a-zA-Z0-9._-]/g, '_')}`;

    const { error: uploadError } = await supabaseAdmin.storage
        .from('attachments')
        .upload(filePath, file, { contentType: file.type });
    if (uploadError) {
        return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    return NextResponse.json({
        storagePath: filePath,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
    });
}
