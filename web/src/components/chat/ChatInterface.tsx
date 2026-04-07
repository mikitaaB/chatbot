'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useChatMessages, type ChatAttachment, type ChatMessage } from '@/hooks/useChatMessages';
import { useChatStream } from '@/hooks/useChatStream';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { GuestQuotaAlert } from './GuestQuotaAlert';
import { useAuth } from '@/hooks/useAuth';
import type { PendingUpload } from '@/lib/upload';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '../ui/button';

export function ChatInterface() {
    const { id: chatId } = useParams();
    const { guest } = useAuth();
    const queryClient = useQueryClient();
    const { messages: serverMessages, isLoading, isError } = useChatMessages(chatId as string);
    const { sendMessage, streamingMessage, isStreaming, error } = useChatStream(chatId as string);
    const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);

    const router = useRouter();

    const allMessages = useMemo<ChatMessage[]>(() => {
        const server: ChatMessage[] = serverMessages ?? [];

        const sortedServer = [...server].sort((a, b) => {
            return new Date(a.created_at ?? 0).getTime() - new Date(b.created_at ?? 0).getTime();
        });

        const optimistic = optimisticMessages.filter((optimisticMessage) => {
            return !sortedServer.some((serverMessage) => serverMessage.id === optimisticMessage.id);
        });

        return sortedServer.concat(optimistic);
    }, [serverMessages, optimisticMessages]);

    const handleSendMessage = async (content: string, pendingUploads?: PendingUpload[]) => {
        const userMsgId = Math.random().toString(36).substring(7);
        const attachments: ChatAttachment[] | undefined = pendingUploads?.map((pendingUpload) => ({
            file_name: pendingUpload.fileName,
            mime_type: pendingUpload.mimeType,
        }));
        const userMsg: ChatMessage = {
            id: userMsgId,
            role: 'USER',
            content,
            created_at: new Date().toISOString(),
            attachments,
        };

        setOptimisticMessages(prev => [...prev, userMsg]);

        try {
            await sendMessage(content, pendingUploads);
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: ['messages', chatId] }),
                queryClient.invalidateQueries({ queryKey: ['chats'] }),
            ]);
            setOptimisticMessages([]);
        } catch (err: unknown) {
            const errMessage = err instanceof Error ? err.message : 'Failed to send message';
            console.error('Failed to send message:', errMessage);
            setOptimisticMessages(prev => prev.filter(m => m.id !== userMsgId));
        }
    };

    if (isError) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="text-center text-red-500">
                    Failed to load messages. Please try again.
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-zinc-950">
            <header className="border-b px-6 py-3 flex items-center justify-between">
                <h1 className="text-lg font-semibold">Chat</h1>
                {guest && <Button size="sm" variant="outline" onClick={() => router.push('/login')}>
                    Sign in
                </Button>}
            </header>

            {guest?.remainingQuota === 0 && <GuestQuotaAlert />}

            <div className="flex-1 overflow-y-auto">
                {error && (
                    <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 p-3 rounded-md text-sm mx-4 mb-2">
                        {error}
                    </div>
                )}
                <MessageList
                    messages={allMessages}
                    isLoading={isLoading}
                    streamingMessage={streamingMessage}
                    isStreaming={isStreaming}
                />
            </div>

            <ChatInput
                onSend={handleSendMessage}
                disabled={isStreaming || (!!guest && guest.remainingQuota === 0)}
                placeholder={
                    guest?.remainingQuota === 0
                        ? 'Free questions limit reached. Please sign in.'
                        : 'Send a message...'
                }
            />
        </div>
    );
}
