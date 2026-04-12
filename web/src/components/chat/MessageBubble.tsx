'use client';

import { cn } from '@/lib/utils';
import type { ChatMessage } from '@/hooks/useChatMessages';
import { AttachmentItem } from './AttachmentItem';
import { MessageAvatar } from './MessageAvatar';
import { StreamingIndicator } from './StreamingIndicator';

interface MessageBubbleProps {
    message: ChatMessage;
}

export function MessageBubble({ message }: Readonly<MessageBubbleProps>) {
    const isUser = message.role === 'USER';
    const attachments = message.attachments ?? [];

    return (
        <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
            {!isUser && <MessageAvatar isUser={false} />}

            <div
                className={cn(
                    'max-w-[80%] rounded-lg px-4 py-2 text-sm',
                    isUser
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground',
                    message.isStreaming && 'animate-pulse'
                )}
            >
                <div className="whitespace-pre-wrap break-words">
                    {message.content || (message.isStreaming && <StreamingIndicator />)}
                </div>
                {attachments.length > 0 && (
                    <div className="mt-3 space-y-2">
                        {attachments.map((a) => (
                            <AttachmentItem key={a.id ?? a.file_name} attachment={a} />
                        ))}
                    </div>
                )}
            </div>

            {isUser && <MessageAvatar isUser />}
        </div>
    );
}
