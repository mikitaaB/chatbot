import { useRouter } from "next/navigation";
import { Button } from "../ui/button";
import { Guest } from "@/contexts/auth-context";

export function ChatHeader({ guest }: Readonly<{ guest: Guest | null }>) {
    const router = useRouter();

    return (
        <header className="border-b px-6 py-3 flex items-center justify-between">
            <h1 className="text-lg font-semibold">Chat</h1>
            {guest && (
                <Button size="sm" variant="outline" onClick={() => router.push('/login')}>
                    Sign in
                </Button>
            )}
        </header>
    );
}