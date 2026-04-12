'use client';

import { useEffect, useRef } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageBubble } from './MessageBubble';
import { Loader2 } from 'lucide-react';
import type { ChatMessage } from '@/hooks/useChatMessages';
import { StreamingMessage } from './StreamingMessage';
import { EmptyState } from './EmptyState';

interface MessageListProps {
    messages: ChatMessage[];
    isLoading: boolean;
    streamingMessage: string;
    isStreaming: boolean;
}

export function MessageList({ messages, isLoading, streamingMessage, isStreaming }: Readonly<MessageListProps>) {
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        scrollRef.current?.scrollIntoView({
            behavior: 'smooth',
        });
    }, [messages, streamingMessage]);

    if (isLoading && messages?.length === 0) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <ScrollArea className="flex-1 p-4">
            <div className="max-w-3xl mx-auto space-y-4">
                {messages?.length === 0 && !streamingMessage && <EmptyState />}

                {messages?.map((msg) => (
                    <MessageBubble
                        key={msg.id}
                        message={msg}
                    />
                ))}

                {isStreaming && !streamingMessage && <StreamingMessage />}

                <div ref={scrollRef} />
            </div>
        </ScrollArea>
    );
}
