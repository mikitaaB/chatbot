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

    const queryKey = ['chats', user?.id, guest?.remainingQuota];

    const {
        data: chats,
        isLoading,
        error,
    } = useQuery<ChatListItem[]>({
        queryKey,
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
        if (!user?.id) return;

        const supabase = getSupabaseBrowserClient();
        const channel = supabase
            .channel(`chats-${user.id}`)
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
    }, [user?.id]);

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
        onSuccess: (newChat) => {
            queryClient.setQueryData<ChatListItem[]>(queryKey, (prev) => {
                if (!prev) return [newChat];
                return [newChat, ...prev];
            });
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
        onSuccess: (_, chatId) => {
            queryClient.setQueryData<ChatListItem[]>(queryKey, (prev) => {
                if (!prev) return prev;
                return prev.filter((c) => c.id !== chatId);
            });
        },
    });

    return { chats, isLoading, error, createChat, deleteChat };
}
