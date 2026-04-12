'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Bot, User } from 'lucide-react';

export function MessageAvatar({ isUser }: Readonly<{ isUser: boolean }>) {
    return (
        <Avatar className="h-8 w-8">
            <AvatarFallback className={isUser ? 'bg-secondary' : 'bg-primary text-primary-foreground'}>
                {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </AvatarFallback>
        </Avatar>
    );
}
