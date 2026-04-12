import { Loader2 } from 'lucide-react';
import { ChatItem } from './ChatItem';
import type { ChatListItem } from '@/hooks/useChats';

interface ChatListProps {
    isAuthenticated: boolean;
    isLoading: boolean;
    chats: ChatListItem[] | undefined;
    currentChatId: string | null;
    isDeleting: boolean;
    onSelectChat: (id: string) => void;
    onDeleteChat: (id: string, e: React.MouseEvent) => void;
}

export function ChatList({
    isAuthenticated,
    isLoading,
    chats,
    currentChatId,
    isDeleting,
    onSelectChat,
    onDeleteChat,
}: Readonly<ChatListProps>) {
    if (!isAuthenticated) return null;

    if (isLoading) {
        return (
            <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!chats?.length) {
        return (
            <div className="text-center py-8 text-muted-foreground text-sm">
                No chats yet<br />
                Click &quot;New chat&quot; to start
            </div>
        );
    }

    return (
        <div className="space-y-1">
            {chats.map((chat) => (
                <ChatItem
                    key={chat.id}
                    chat={chat}
                    isActive={currentChatId === chat.id}
                    isDeleting={isDeleting}
                    onSelect={onSelectChat}
                    onDelete={onDeleteChat}
                />
            ))}
        </div>
    );
}
