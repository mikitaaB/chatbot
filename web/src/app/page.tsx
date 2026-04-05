'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useChats } from '@/hooks/useChats';

export default function HomePage() {
    const { chats, isLoading, createChat } = useChats();
    const router = useRouter();
    const hasCreated = useRef(false);

    useEffect(() => {
        if (chats && chats.length > 0) {
            router.replace(`/chat/${chats[0].id}`);
            return;
        }

        if (!isLoading && chats?.length === 0 && !hasCreated.current && !createChat.isPending) {
            hasCreated.current = true;
            createChat.mutate(undefined, {
                onSuccess: (chat) => {
                    router.replace(`/chat/${chat.id}`);
                },
                onError: () => {
                    hasCreated.current = false;
                },
            });
        }
    }, [chats, isLoading, createChat, router]);

    return (
        <div className="flex items-center justify-center h-screen">
            <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
                <p className="mt-2 text-muted-foreground">Loading...</p>
            </div>
        </div>
    );
}