import { Button } from '@/components/ui/button';
import { PlusCircle } from 'lucide-react';

interface NewChatButtonProps {
    isAuthenticated: boolean;
    onCreate: () => void;
    isPending: boolean;
}

export function NewChatButton({ isAuthenticated, onCreate, isPending }: Readonly<NewChatButtonProps>) {
    if (!isAuthenticated) return null;

    return (
        <div className="p-4 border-b">
            <Button
                onClick={onCreate}
                className="w-full gap-2"
                disabled={isPending}
            >
                <PlusCircle className="h-4 w-4" />
                {isPending ? 'Creating...' : 'New chat'}
            </Button>
        </div>
    );
}