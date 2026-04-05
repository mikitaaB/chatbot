import { useQuery } from '@tanstack/react-query';
import { useAuth } from './useAuth';

export type ChatAttachment = {
    id?: string;
    file_name: string;
    mime_type: string;
};

export type ChatMessage = {
    id?: string;
    temp_id?: string;
    role: string;
    content: string;
    created_at?: string;
    isStreaming?: boolean;
    attachments?: ChatAttachment[];
};

type ChatMessagesResponse = {
    messages: ChatMessage[];
};

export function useChatMessages(chatId: string) {
    const { accessToken, loading: authLoading } = useAuth();

    const query = useQuery<ChatMessage[]>({
        queryKey: ['messages', chatId, accessToken],
        queryFn: async () => {
            const headers: HeadersInit = {};
            if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
            const res = await fetch(`/api/chats/${chatId}/messages`, {
                headers,
                credentials: 'include',
            });
            if (!res.ok) throw new Error('Failed to load messages');
            const data = (await res.json()) as ChatMessagesResponse;
            return data.messages;
        },
        enabled: !!chatId && !authLoading,
    });

    return {
        ...query,
        messages: query.data ?? [],
    };
}
