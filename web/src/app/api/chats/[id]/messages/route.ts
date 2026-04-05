import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helper';
import { prisma } from '@/lib/prisma';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createGeminiStream, type GeminiPart } from '@/lib/gemini-stream';
import { extractTextFromFile } from '@/lib/file-extractors';

type PendingUpload = {
    storagePath: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
};

type MessageWithAttachments = {
    role: string;
    content: string | null;
};

const supportedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const supportedDocumentTypes = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown',
    'text/javascript',
    'application/json',
]);

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await getUserFromRequest(req);
    const { id: chatId } = await params;

    const where =
        auth.type === 'authenticated'
            ? { id: chatId, user_id: auth.userId }
            : { id: chatId, guest_token_hash: auth.guestId };
    const chat = await prisma.chat.findFirst({ where });
    if (!chat) {
        return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    const messages = await prisma.message.findMany({
        where: { chat_id: chatId },
        orderBy: { created_at: 'asc' },
        include: { attachments: true },
    });

    return NextResponse.json({ messages });
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await getUserFromRequest(req);
    const { id: chatId } = await params;

    const whereChat =
        auth.type === 'authenticated'
            ? { id: chatId, user_id: auth.userId }
            : { id: chatId, guest_token_hash: auth.guestId };
    const chat = await prisma.chat.findFirst({ where: whereChat });
    if (!chat) {
        return new Response('Chat not found', { status: 404 });
    }

    if (auth.type === 'guest' && auth.remainingQuota <= 0) {
        return new Response('Guest quota exceeded. Please sign up.', { status: 403 });
    }

    const body = (await req.json()) as {
        content?: string;
        pendingUploads?: PendingUpload[];
    };
    const { content, pendingUploads } = body;

    if (!content?.trim() && (!pendingUploads || pendingUploads.length === 0)) {
        return new Response('Content or attachments required', { status: 400 });
    }

    const userMessage = await prisma.message.create({
        data: {
            chat_id: chatId,
            role: 'USER',
            content: content || null,
            attachments:
                pendingUploads && pendingUploads.length > 0
                    ? {
                        create: pendingUploads.map(p => ({
                            storage_path: p.storagePath,
                            file_name: p.fileName,
                            file_size: p.fileSize,
                            mime_type: p.mimeType,
                        })),
                    }
                    : undefined,
        },
        include: { attachments: true },
    });

    const history = await prisma.message.findMany({
        where: { chat_id: chatId },
        orderBy: { created_at: 'asc' },
        take: 20,
        include: { attachments: true },
    });

    let docsContext = '';
    const promptParts: GeminiPart[] = [];

    for (const att of userMessage.attachments) {
        const { data: fileData, error } = await supabaseAdmin.storage
            .from('attachments')
            .download(att.storage_path);
        if (!error && fileData) {
            if (supportedImageTypes.has(att.mime_type)) {
                const buffer = Buffer.from(await fileData.arrayBuffer());
                promptParts.push({
                    inlineData: {
                        mimeType: att.mime_type,
                        data: buffer.toString('base64'),
                    },
                }, {
                    text: `User attached image: ${att.file_name}`,
                });
            } else if (supportedDocumentTypes.has(att.mime_type)) {
                const text = await extractTextFromFile(fileData, att.mime_type);
                if (text.trim()) {
                    docsContext += `\n[Document: ${att.file_name}]\n${text}\n`;
                }
            }
        }
    }

    const formattedHistory = history
        .map((message: MessageWithAttachments) => `${message.role}: ${message.content ?? ''}`)
        .join('\n');

    const fullPrompt = `
You are a helpful AI assistant.
${docsContext ? `\nContext from uploaded documents:\n${docsContext}\n` : ''}
${formattedHistory ? `\nRecent conversation history:\n${formattedHistory}\n` : ''}
User: ${content || (pendingUploads && pendingUploads.length > 0 ? 'See attached documents' : '')}
Assistant:`;

    const stream = await createGeminiStream([{ text: fullPrompt }, ...promptParts]);

    let fullAssistantResponse = '';
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    const transformStream = new TransformStream({
        transform(chunk, controller) {
            const text = decoder.decode(chunk);

            const lines = text.split('\n');

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;

                const data = line.replace('data: ', '').trim();

                if (data === '[DONE]') continue;

                try {
                    const json = JSON.parse(data);
                    const delta = json?.choices?.[0]?.delta?.content;
                    if (delta) {
                        fullAssistantResponse += delta;
                        controller.enqueue(encoder.encode(delta));
                    }
                } catch (e) {
                    console.error('JSON parse error', e);
                }
            }
        },

        async flush() {
            await prisma.message.create({
                data: {
                    chat_id: chatId,
                    role: 'ASSISTANT',
                    content: fullAssistantResponse,
                },
            });

            if (auth.type === 'guest') {
                await prisma.guestSession.update({
                    where: { guest_token_hash: auth.guestId },
                    data: { remaining_quota: { decrement: 1 } },
                });
            }

            await prisma.chat.update({
                where: { id: chatId },
                data: { updated_at: new Date() },
            });
        },
    });

    const pipedStream = stream.pipeThrough(transformStream);

    return new Response(pipedStream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
        },
    });
}
