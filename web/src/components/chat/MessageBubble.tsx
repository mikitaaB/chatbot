'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, FileText, Image as ImageIcon, User } from 'lucide-react';
import type { ChatAttachment, ChatMessage } from '@/hooks/useChatMessages';

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

interface MessageBubbleProps {
    message: ChatMessage;
}

export function MessageBubble({ message }: Readonly<MessageBubbleProps>) {
    const isUser = message.role === 'USER';
    const attachments = message.attachments ?? [];

    const renderAttachment = (attachment: ChatAttachment, index: number) => {
        const isImage = IMAGE_MIME_TYPES.includes(attachment.mime_type);
        const href = attachment.id ? `/api/attachments/${attachment.id}` : undefined;

        if (isImage && href) {
            return (
                <a
                    key={`${attachment.id ?? attachment.file_name}-${index}`}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    className="block overflow-hidden rounded-md border border-border/60"
                >
                    <Image
                        src={href}
                        alt={attachment.file_name}
                        width={720}
                        height={480}
                        unoptimized
                        className="max-h-72 w-full rounded-md object-cover"
                    />
                </a>
            );
        }

        return (
            <a
                key={`${attachment.id ?? attachment.file_name}-${index}`}
                href={href}
                target={href ? '_blank' : undefined}
                rel={href ? 'noreferrer' : undefined}
                className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-xs"
            >
                {isImage ? <ImageIcon className="h-4 w-4 shrink-0" /> : <FileText className="h-4 w-4 shrink-0" />}
                <span className="truncate">{attachment.file_name}</span>
            </a>
        );
    };

    return (
        <div className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}>
            {!isUser && (
                <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                        <Bot className="h-4 w-4" />
                    </AvatarFallback>
                </Avatar>
            )}

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
                    {message.content || (message.isStreaming && (
                        <div className="flex gap-1 items-center py-1">
                            <div className="h-1.5 w-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <div className="h-1.5 w-1.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <div className="h-1.5 w-1.5 bg-current rounded-full animate-bounce" />
                        </div>
                    ))}
                </div>
                {attachments.length > 0 && (
                    <div className="mt-3 space-y-2">
                        {attachments.map(renderAttachment)}
                    </div>
                )}
            </div>

            {isUser && (
                <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-secondary">
                        <User className="h-4 w-4" />
                    </AvatarFallback>
                </Avatar>
            )}
        </div>
    );
}
