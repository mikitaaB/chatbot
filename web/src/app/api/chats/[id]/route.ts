import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helper';
import { prisma } from '@/lib/prisma';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id: chatId } = await params;
    const auth = await getUserFromRequest(req);

    const where = auth.type === 'authenticated'
        ? { id: chatId, user_id: auth.userId }
        : { id: chatId, guest_token_hash: auth.guestId };

    const chat = await prisma.chat.findFirst({ where });
    if (!chat) {
        return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    await prisma.chat.delete({ where: { id: chatId } });
    return new NextResponse(null, { status: 204 });
}