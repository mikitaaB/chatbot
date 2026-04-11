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
        setError(null);

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
        };

        if (accessToken) {
            headers.Authorization = `Bearer ${accessToken}`;
        }

        try {
            const response = await fetch(`/api/chats/${chatId}/messages`, {
                method: 'POST',
                credentials: 'include',
                body: JSON.stringify({
                    content,
                    pendingUploads,
                }),
                headers,
            });

            if (!response.body) {
                throw new Error('Failed to send message');
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();

            let result = '';
            while (true) {
                const { value, done } =
                    await reader.read();
                if (done) break;
                const text = decoder.decode(value, {
                    stream: true,
                });
                if (!text) continue;
                result += text;
                setStreamingMessage(result);
            }

            setIsStreaming(false);
            await refreshAuth();
        } catch (err: unknown) {
            const errMessage = err instanceof Error ? err.message : "An unknown error occurred";
            setError(errMessage);
        } finally {
            setIsStreaming(false);
        }
    };

    return { sendMessage, streamingMessage, isStreaming, error };
}
