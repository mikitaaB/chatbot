import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { useAuth } from './useAuth';

export type ChatListItem = {
    id: string;
    title: string | null;
};

export function useChats() {
    const { user, accessToken, guest } = useAuth();
    const queryClient = useQueryClient();

    const {
        data: chats,
        isLoading,
        error,
    } = useQuery<ChatListItem[]>({
        queryKey: ['chats', user?.id, guest?.remainingQuota],
        queryFn: async () => {
            const headers: HeadersInit = {};
            if (accessToken) {
                headers.Authorization = `Bearer ${accessToken}`;
            }
            const res = await fetch('/api/chats', {
                headers,
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to fetch chats');
            return (await res.json()) as ChatListItem[];
        },
        enabled: !!user || !!guest,
    });

    useEffect(() => {
        if (!user) return;

        const supabase = getSupabaseBrowserClient();
        const channelId = `chats-realtime-${Math.random().toString(36).slice(2, 9)}`;
        const channel = supabase
            .channel(channelId)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'chats',
                    filter: `user_id=eq.${user.id}`,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['chats'] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [user, queryClient]);

    const createChat = useMutation<ChatListItem, Error, string | undefined>({
        mutationFn: async (title?: string) => {
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
            const res = await fetch('/api/chats', {
                method: 'POST',
                credentials: 'include',
                body: JSON.stringify({ title }),
                headers,
            });
            if (!res.ok) throw new Error('Failed to create chat');
            return (await res.json()) as ChatListItem;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chats'] });
        },
    });

    const deleteChat = useMutation<void, Error, string>({
        mutationFn: async (chatId: string) => {
            const headers: HeadersInit = {};
            if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
            const res = await fetch(`/api/chats/${chatId}`, {
                method: 'DELETE',
                credentials: 'include',
                headers,
            });
            if (!res.ok) throw new Error('Failed to delete chat');
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['chats'] });
        },
    });

    return { chats, isLoading, error, createChat, deleteChat };
}
