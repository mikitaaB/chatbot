import { useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { RealtimeChannel } from '@supabase/supabase-js';

export function useRealtimeChats() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const supabaseRef = useRef(createClient());
    const channelRef = useRef<RealtimeChannel | null>(null);

    useEffect(() => {
        if (!user?.id) return;
        const supabase = supabaseRef.current;

        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }

        const channel = supabase
            .channel(`chats-${user.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'chats',
                filter: `user_id=eq.${user.id}`,
            }, () => {
                queryClient.invalidateQueries({ queryKey: ['chats'] });
            })
            .subscribe();

        channelRef.current = channel;

        return () => {
            if (channelRef.current) {
                supabase.removeChannel(channelRef.current);
                channelRef.current = null;
            }
        };
    }, [user?.id]);
}
