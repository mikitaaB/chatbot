'use client';

import { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/contexts/auth-context';

const queryClient = new QueryClient();

export function Providers({ children }: Readonly<{ children: ReactNode }>) {
    return (
        <QueryClientProvider client={queryClient}>
            <AuthProvider>
                {children}
            </AuthProvider>
        </QueryClientProvider>
    );
}