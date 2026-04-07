import { useState } from 'react';
import { useAuth } from './useAuth';
import type { PendingUpload } from '@/lib/upload';

export function useChatStream(chatId: string) {
    const [streamingMessage, setStreamingMessage] = useState('');
    const [isStreaming, setIsStreaming] = useState(false);
    const [error, setError] = useState<string | null>(null);
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
                if (response.status === 503 || response.status === 429) {
                    throw new Error("AI service is busy. Please try again in a moment.");
                }
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
        } catch (err: unknown) {
            const errMessage = err instanceof Error ? err.message : "An unknown error occurred";
            setError(errMessage );
        } finally {
            setIsStreaming(false);
        }
    };

    return { sendMessage, streamingMessage, isStreaming, error };
}
