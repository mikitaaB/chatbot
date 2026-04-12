'use client';

import { MouseEvent } from 'react';
import { type ChatListItem } from '@/hooks/useChats';
import { Button } from '@/components/ui/button';
import { MessageSquare, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ChatItem({
    chat,
    isActive,
    onSelect,
    onDelete,
    isDeleting
}: Readonly<{
    chat: ChatListItem;
    isActive: boolean;
    isDeleting: boolean;
    onSelect: (id: string) => void;
    onDelete: (id: string, e: MouseEvent) => void;
}>) {
    return (
        <div
            onClick={() => onSelect(chat.id)}
            className={cn(
                'group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors',
                isActive
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-muted'
            )}
        >
            <div className="flex items-center gap-2 truncate">
                <MessageSquare className="h-4 w-4 shrink-0" />
                <span className="truncate text-sm">
                    {chat.title || 'New conversation'}
                </span>
            </div>
            <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => onDelete(chat.id, e)}
                disabled={isDeleting}
                aria-label="Delete chat"
            >
                <Trash2 className="h-3 w-3" />
            </Button>
        </div>
    );
};
