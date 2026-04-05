'use client';

import { useChats, type ChatListItem } from '@/hooks/useChats';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PlusCircle, MessageSquare, Trash2, LogOut, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePathname, useRouter } from 'next/navigation';

export function ChatSidebar() {
    const { user, guest, signOut } = useAuth();
    const { chats, isLoading, createChat, deleteChat } = useChats();
    const router = useRouter();
    const pathname = usePathname();
    const currentChatId = pathname?.split('/').pop();

    const handleNewChat = async () => {
        const newChat = await createChat.mutateAsync(undefined);
        router.push(`/chat/${newChat.id}`);
    };

    const handleDeleteChat = async (chatId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        await deleteChat.mutateAsync(chatId);
        if (currentChatId === chatId) {
            router.push('/');
        }
    };

    return (
        <div className="w-80 h-screen bg-zinc-50 dark:bg-zinc-900 border-r flex flex-col">
            {user && <div className="p-4 border-b">
                <Button
                    onClick={handleNewChat}
                    className="w-full gap-2"
                    disabled={createChat.isPending}
                >
                    <PlusCircle className="h-4 w-4" />
                    {createChat.isPending ? 'Creating...' : 'New chat'}
                </Button>
            </div>}

            {guest && (
                <div className="px-4 pt-2">
                    <div className="bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 text-sm p-2 rounded-md">
                        Free questions left: {guest.remainingQuota} / 3
                    </div>
                </div>
            )}

            <ScrollArea className="flex-1 px-2 py-2">
                {user && <>
                    {isLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : chats?.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground text-sm">
                            No chats yet<br />
                            Click &quot;New chat&quot; to start
                        </div>
                    ) : (
                        <div className="space-y-1">
                            {chats?.map((chat: ChatListItem) => (
                                <div
                                    key={chat.id}
                                    onClick={() => router.push(`/chat/${chat.id}`)}
                                    className={cn(
                                        'group flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors',
                                        currentChatId === chat.id
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
                                        onClick={(e) => handleDeleteChat(chat.id, e)}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                </div>
                            ))}
                        </div>
                    )}
                </>}
            </ScrollArea>

            <div className="border-t p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 truncate">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm truncate">
                            {user?.email || 'Guest'}
                        </span>
                    </div>
                    {user && (
                        <Button variant="ghost" size="sm" onClick={signOut}>
                            <LogOut className="h-4 w-4 mr-1" />
                            Logout
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
}
