import { MessageBubble } from './MessageBubble';

export function StreamingMessage() {
    return (
        <MessageBubble
            message={{
                role: 'ASSISTANT',
                content: '',
                isStreaming: true,
            }}
        />
    );
}
