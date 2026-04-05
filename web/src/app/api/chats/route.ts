import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helper';
import { prisma } from '@/lib/prisma';

const chatListInclude = {
    messages: {
        orderBy: { created_at: 'desc' as const },
        take: 1,
    },
};

export async function GET(req: NextRequest) {
    const auth = await getUserFromRequest(req);

    if (auth.type === 'authenticated') {
        const chats = await prisma.chat.findMany({
            where: { user_id: auth.userId },
            orderBy: { updated_at: 'desc' },
            include: chatListInclude,
        });
        return NextResponse.json(chats);
    }

    const chats = await prisma.chat.findMany({
        where: { guest_token_hash: auth.guestId },
        orderBy: { updated_at: 'desc' },
        include: chatListInclude,
    });

    return NextResponse.json(chats);
}

export async function POST(req: NextRequest) {
    const auth = await getUserFromRequest(req);
    const { title } = await req.json();

    if (auth.type === 'authenticated') {
        const chat = await prisma.chat.create({
            data: {
                title: title || 'New chat',
                user: { connect: { id: auth.userId } },
            },
        });
        return NextResponse.json(chat, { status: 201 });
    }

    const chat = await prisma.chat.create({
        data: {
            title: title || 'New chat',
            guest_token_hash: auth.guestId,
        },
    });
    return NextResponse.json(chat, { status: 201 });
}
