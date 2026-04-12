import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth-helper';
import { createGeminiStream, type GeminiPart } from '@/lib/gemini-stream';
import { extractTextFromFile } from '@/lib/file-extractors';
import { createClient } from '@/utils/supabase/server';
import { supabaseAdmin } from '@/utils/supabase/service';

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
    const supabase = await createClient();
    let chat = null;

    if (auth.type === 'authenticated') {
        const { data } = await supabase
            .from('chats')
            .select('id')
            .eq('id', chatId)
            .eq('user_id', auth.userId)
            .maybeSingle();
        chat = data;
    } else {
        const { data: guestSession } = await supabaseAdmin
            .from('guest_sessions')
            .select('id')
            .eq('guest_token_hash', auth.guestId)
            .maybeSingle();

        if (!guestSession) {
            return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
        }

        const { data } = await supabaseAdmin
            .from('chats')
            .select('id')
            .eq('id', chatId)
            .eq('guest_session_id', guestSession.id)
            .maybeSingle();
        chat = data;
    }

    if (!chat) {
        return NextResponse.json({ error: 'Chat not found' }, { status: 404 });
    }

    let messagesQuery;
    if (auth.type === 'authenticated') {
        messagesQuery = supabase
            .from('messages')
            .select(`*, attachments (*)`)
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true });
    } else {
        messagesQuery = supabaseAdmin
            .from('messages')
            .select(`*, attachments (*)`)
            .eq('chat_id', chatId)
            .order('created_at', { ascending: true });
    }

    const { data: messages, error } = await messagesQuery;
    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages });
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await getUserFromRequest(req);
    const { id: chatId } = await params;
    const supabase = await createClient();

    let dbClient;
    let guestSession = null;

    if (auth.type === 'authenticated') {
        dbClient = supabase;
    } else {
        dbClient = supabaseAdmin;

        const { data: session, error: guestError } = await supabaseAdmin
            .from('guest_sessions')
            .select('id, remaining_quota')
            .eq('guest_token_hash', auth.guestId)
            .maybeSingle();

        if (guestError || !session) {
            return new Response('Chat not found', { status: 404 });
        }
        guestSession = session;

        if (guestSession.remaining_quota <= 0) {
            return new Response('Guest quota exceeded. Please sign up.', { status: 403 });
        }
    }

    let chatQuery = dbClient
        .from('chats')
        .select('id')
        .eq('id', chatId);

    if (auth.type === 'authenticated') {
        chatQuery = chatQuery.eq('user_id', auth.userId);
    } else {
        chatQuery = chatQuery.eq('guest_session_id', guestSession!.id);
    }

    const { data: chat, error: chatError } = await chatQuery.maybeSingle();

    if (!chat || chatError) {
        return new Response('Chat not found', { status: 404 });
    }

    const body = (await req.json()) as {
        content?: string;
        pendingUploads?: PendingUpload[];
    };
    const { content, pendingUploads } = body;

    if (!content?.trim() && (!pendingUploads || pendingUploads.length === 0)) {
        return new Response('Content or attachments required', { status: 400 });
    }

    const messageData: any = {
        chat_id: chatId,
        role: 'USER',
        content: content || null,
    };

    const { data: userMessage, error: msgError } = await dbClient
        .from('messages')
        .insert(messageData)
        .select(`
            *,
            attachments (*)
        `)
        .single();

    if (msgError || !userMessage) {
        console.error('Failed to create message:', msgError);
        return new Response('Failed to create message', { status: 500 });
    }

    if (pendingUploads && pendingUploads.length > 0) {
        const attachmentsData = pendingUploads.map(p => ({
            message_id: userMessage.id,
            storage_path: p.storagePath,
            file_name: p.fileName,
            file_size: p.fileSize,
            mime_type: p.mimeType,
        }));

        const { error: attError } = await dbClient
            .from('attachments')
            .insert(attachmentsData);

        if (attError) {
            console.error('Failed to create attachments:', attError);
            await dbClient.from('messages').delete().eq('id', userMessage.id);
            return new Response('Failed to save attachments', { status: 500 });
        }
        const { data: refreshed } = await dbClient
            .from('messages')
            .select(`*, attachments (*)`)
            .eq('id', userMessage.id)
            .single();

        if (refreshed) {
            Object.assign(userMessage, refreshed);
        }
    }

    const { data: history, error: histError } = await dbClient
        .from('messages')
        .select(`
            *,
            attachments (*)
        `)
        .eq('chat_id', chatId)
        .order('created_at', { ascending: true })
        .limit(20);

    if (histError) {
        console.error('Failed to fetch history:', histError);
    }

    let docsContext = '';
    const promptParts: GeminiPart[] = [];

    for (const att of userMessage.attachments || []) {
        const { data: fileData, error } = await dbClient.storage
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
        } else {
            console.error('Failed to download file:', att.storage_path, error);
        }
    }

    const formattedHistory = (history || [])
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
            const { error: assistantError } = await dbClient
                .from('messages')
                .insert({
                    chat_id: chatId,
                    role: 'ASSISTANT',
                    content: fullAssistantResponse,
                });

            if (assistantError) {
                console.error('Failed to save assistant message:', assistantError);
            }

            const { error: chatUpdateError } = await dbClient
                .from('chats')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', chatId);

            if (chatUpdateError) {
                console.error('Failed to update chat timestamp:', chatUpdateError);
            }
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
