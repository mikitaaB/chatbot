'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { createClient } from '@/utils/supabase/client';

interface User {
    id: string;
    email?: string;
}

interface Guest {
    remainingQuota: number;
}

interface MeAuthenticated {
    type: 'authenticated';
    userId: string;
    email?: string;
}

interface MeGuest {
    type: 'guest';
    remainingQuota: number;
}

type MeResponse = MeAuthenticated | MeGuest;

interface AuthContextValue {
    user: User | null;
    accessToken: string | null;
    guest: Guest | null;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ id?: string; email?: string } | undefined>;
    signOut: () => Promise<void>;
    refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
    const [user, setUser] = useState<User | null>(null);
    const [accessToken, setAccessToken] = useState<string | null>(null);
    const [guest, setGuest] = useState<Guest | null>(null);
    const [loading, setLoading] = useState(true);
    const pendingSync = useRef<Promise<void> | null>(null);

    const syncFromServer = useCallback(async () => {
        if (pendingSync.current) {
            await pendingSync.current;
            return;
        }

        pendingSync.current = (async () => {
            try {
                const supabase = createClient();
                const { data } = await supabase.auth.getSession();
                const token = data.session?.access_token ?? null;
                setAccessToken(token);

                const res = await fetch('/api/user/me', {
                    credentials: 'include',
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                });

                if (!res.ok) {
                    console.error('Failed to fetch user info:', res.status);
                    return;
                }

                const result = (await res.json()) as MeResponse;

                if (result.type === 'authenticated') {
                    setUser({ id: result.userId, email: result.email });
                    setGuest(null);
                } else {
                    setGuest({ remainingQuota: result.remainingQuota });
                    setUser(null);
                }
            } catch (error) {
                console.error('Error syncing auth state:', error);
            } finally {
                setLoading(false);
                pendingSync.current = null;
            }
        })();

        await pendingSync.current;
    }, []);

    useEffect(() => {
        syncFromServer();

        const supabase = createClient();
        const { data: listener } = supabase.auth.onAuthStateChange(() => {
            syncFromServer();
        });

        return () => {
            listener.subscription.unsubscribe();
        };
    }, [syncFromServer]);

    const signIn = useCallback(
        async (email: string, password: string) => {
            const res = await fetch('/api/auth/signin', {
                method: 'POST',
                credentials: 'include',
                body: JSON.stringify({ email, password }),
                headers: { 'Content-Type': 'application/json' },
            });
            const { access_token, user: userData } = await res.json();
            if (access_token) {
                const supabase = createClient();
                await supabase.auth.setSession({ access_token, refresh_token: '' });
                await syncFromServer();
            }
            return userData;
        },
        [syncFromServer],
    );

    const signOut = useCallback(async () => {
        const supabase = createClient();
        await supabase.auth.signOut();
        await fetch('/api/auth/signout', { method: 'POST', credentials: 'include' });
        await syncFromServer();
    }, [syncFromServer]);

    const value = useMemo(
        () => ({ user, accessToken, guest, loading, signIn, signOut, refreshAuth: syncFromServer }),
        [user, accessToken, guest, loading, signIn, signOut, syncFromServer],
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return ctx;
}
