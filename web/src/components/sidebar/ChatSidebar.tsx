'use client';

import { MouseEvent } from 'react';
import { useChats } from '@/hooks/useChats';
import { useAuth } from '@/hooks/useAuth';
import { ScrollArea } from '@/components/ui/scroll-area';
import { usePathname, useRouter } from 'next/navigation';
import { NewChatButton } from './NewChatButton';
import { GuestQuotaBadge } from './GuestQuotaBadge';
import { SidebarFooter } from './SidebarFooter';
import { ChatList } from './ChatList';

export function ChatSidebar() {
    const { user, guest, signOut } = useAuth();
    const { chats, isLoading, createChat, deleteChat } = useChats();
    const router = useRouter();
    const pathname = usePathname();
    const currentChatId = pathname?.startsWith('/chat/')
        ? pathname.split('/').pop() ?? null
        : null;

    const handleNewChat = async () => {
        try {
            const newChat = await createChat.mutateAsync(undefined);
            router.push(`/chat/${newChat.id}`);
        } catch (error) {
            console.error('Failed to create a new chat: ', error);
        }
    };

    const handleDeleteChat = async (chatId: string, e: MouseEvent) => {
        e.stopPropagation();

        const remainingChats = chats?.filter(c => c.id !== chatId) ?? [];

        try {
            await deleteChat.mutateAsync(chatId);
            if (currentChatId === chatId) {
                if (remainingChats.length > 0) {
                    router.push(`/chat/${remainingChats[0].id}`);
                } else {
                    const newChat = await createChat.mutateAsync(undefined);
                    router.push(`/chat/${newChat.id}`);
                }
            }
        } catch (error) {
            console.error('Failed to delete chat: ', error);
        }
    };

    const handleSignOut = async () => {
        try {
            await signOut();
            router.push('/');
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="w-80 h-screen bg-zinc-50 dark:bg-zinc-900 border-r flex flex-col">
            <NewChatButton
                isAuthenticated={!!user}
                onCreate={handleNewChat}
                isPending={createChat.isPending}
            />

            <GuestQuotaBadge
                isGuest={!!guest}
                remainingQuota={guest?.remainingQuota || 0}
            />

            <ScrollArea className="flex-1 px-2 py-2">
                <ChatList
                    isAuthenticated={!!user}
                    isLoading={isLoading}
                    chats={chats}
                    currentChatId={currentChatId}
                    isDeleting={deleteChat.isPending}
                    onSelectChat={(id) => router.push(`/chat/${id}`)}
                    onDeleteChat={handleDeleteChat}
                />
            </ScrollArea>

            <SidebarFooter
                user={user}
                onSignOut={handleSignOut}
            />
        </div>
    );
}
