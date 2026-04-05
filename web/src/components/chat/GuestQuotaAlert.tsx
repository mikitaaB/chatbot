'use client';

import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

export function GuestQuotaAlert() {
    const router = useRouter();

    return (
        <div className="bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800 p-3 text-center">
            <div className="flex items-center justify-center gap-2 text-red-700 dark:text-red-300">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">
                    You have reached the limit of 3 free questions. Please sign in to continue.
                </span>
                <Button size="sm" variant="outline" onClick={() => router.push('/login')}>
                    Sign in
                </Button>
            </div>
        </div>
    );
}