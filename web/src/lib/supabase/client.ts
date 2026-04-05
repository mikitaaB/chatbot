import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

function createMockBrowserClient(): SupabaseClient {
    return {
        auth: {
            getSession: async () => ({ data: { session: null } }),
            onAuthStateChange: () => ({
                data: { subscription: { unsubscribe: () => {} } },
            }),
            signOut: async () => ({ error: null }),
            setSession: async () => ({ data: { session: null, user: null }, error: null }),
        },
        channel: () =>
            ({
                on: () => ({
                    subscribe: () => ({}),
                }),
            }) as unknown as ReturnType<SupabaseClient['channel']>,
        removeChannel: () => {},
    } as unknown as SupabaseClient;
}

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
    if (browserClient) return browserClient;

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.warn('[Supabase] Environment variables are not set');
        browserClient = createMockBrowserClient();
        return browserClient;
    }

    browserClient = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    );
    return browserClient;
}
