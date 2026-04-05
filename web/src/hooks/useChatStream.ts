import { useState } from 'react';
import { useAuth } from './useAuth';
import type { PendingUpload } from '@/lib/upload';

export function useChatStream(chatId: string) {
    const [streamingMessage, setStreamingMessage] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const { accessToken, refreshAuth } = useAuth();

    const sendMessage = async (content: string, pendingUploads?: PendingUpload[]) => {
        setIsStreaming(true);
        setStreamingMessage('');

        const headers: HeadersInit = { 'Content-Type': 'application/json' };
        if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

        try {
            const response = await fetch(`/api/chats/${chatId}/messages`, {
                method: 'POST',
                credentials: 'include',
                body: JSON.stringify({ content, pendingUploads }),
                headers,
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to send message');
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            while (reader) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = decoder.decode(value);
                setStreamingMessage(prev => prev + chunk);
            }

            await refreshAuth();
        } finally {
            setIsStreaming(false);
        }
    };

    return { sendMessage, streamingMessage, isStreaming };
}
