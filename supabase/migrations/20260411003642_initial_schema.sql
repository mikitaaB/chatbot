CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
    CREATE TYPE "Role" AS ENUM ('USER', 'ASSISTANT', 'SYSTEM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "profiles" (
    "id" UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    "email" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "guest_sessions" (
    "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "guest_token_hash" TEXT NOT NULL UNIQUE,
    "remaining_quota" INTEGER NOT NULL DEFAULT 3,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "chats" (
    "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "user_id" UUID REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "guest_session_id" UUID REFERENCES "guest_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    "title" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chats_owner_check CHECK (
        (user_id IS NOT NULL AND guest_session_id IS NULL) OR
        (user_id IS NULL AND guest_session_id IS NOT NULL)
    )
);
CREATE INDEX IF NOT EXISTS "chats_user_id_updated_at_idx" ON "chats"("user_id", "updated_at");
CREATE INDEX IF NOT EXISTS "chats_guest_session_id_updated_at_idx" ON "chats"("guest_session_id", "updated_at");
CREATE UNIQUE INDEX IF NOT EXISTS "chats_guest_session_id_unique" ON "chats" ("guest_session_id") WHERE "guest_session_id" IS NOT NULL;

CREATE TABLE IF NOT EXISTS "messages" (
    "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "chat_id" UUID NOT NULL REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "role" "Role" NOT NULL,
    "content" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "messages_chat_id_created_at_idx" ON "messages"("chat_id", "created_at");

CREATE TABLE IF NOT EXISTS "attachments" (
    "id" UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    "message_id" UUID NOT NULL REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    "storage_path" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "file_size" BIGINT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "attachments_message_id_idx" ON "attachments"("message_id");

-- Function to update updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_guest_sessions_updated_at ON public.guest_sessions;
CREATE TRIGGER update_guest_sessions_updated_at
    BEFORE UPDATE ON public.guest_sessions
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_chats_updated_at ON public.chats;
CREATE TRIGGER update_chats_updated_at
    BEFORE UPDATE ON public.chats
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_messages_updated_at ON public.messages;
CREATE TRIGGER update_messages_updated_at
    BEFORE UPDATE ON public.messages
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Triggers for profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, updated_at)
    VALUES (NEW.id, NEW.email, NOW())
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.profiles SET email = NEW.email, updated_at = NOW()
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_email_update ON auth.users;
CREATE TRIGGER on_auth_user_email_update
    AFTER UPDATE OF email ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

-- Trigger. Decrement guest message quota
CREATE OR REPLACE FUNCTION public.decrement_guest_quota_on_message()
RETURNS TRIGGER AS $$
DECLARE
    v_guest_session_id UUID;
    v_current_quota INTEGER;
BEGIN
    SELECT guest_session_id INTO v_guest_session_id
    FROM public.chats
    WHERE id = NEW.chat_id;

    IF v_guest_session_id IS NULL OR NEW.role != 'USER' THEN
        RETURN NEW;
    END IF;

    SELECT remaining_quota INTO v_current_quota
    FROM public.guest_sessions
    WHERE id = v_guest_session_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Guest session % not found', v_guest_session_id;
    END IF;

    IF v_current_quota <= 0 THEN
        RAISE EXCEPTION 'Guest quota exceeded for session %', v_guest_session_id;
    END IF;

    UPDATE public.guest_sessions
    SET remaining_quota = remaining_quota - 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = v_guest_session_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_decrement_guest_quota ON public.messages;
CREATE TRIGGER trg_decrement_guest_quota
    AFTER INSERT ON public.messages
    FOR EACH ROW
    EXECUTE FUNCTION public.decrement_guest_quota_on_message();

CREATE OR REPLACE FUNCTION public.check_guest_token_from_path(path text)
RETURNS boolean AS $$
DECLARE
    guest_hash text;
BEGIN
    guest_hash := split_part(path, '/', 2);
    IF guest_hash = '' THEN
        RETURN false;
    END IF;
    RETURN EXISTS (SELECT 1 FROM public.guest_sessions WHERE guest_token_hash = guest_hash);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT USING (id = (SELECT auth.uid()));
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE USING (id = (SELECT auth.uid())) WITH CHECK (id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "chats_owner" ON public.chats;
CREATE POLICY "chats_owner" ON public.chats
    FOR ALL USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "messages_owner" ON public.messages;
CREATE POLICY "messages_owner" ON public.messages
    FOR ALL USING (
        EXISTS (SELECT 1 FROM public.chats c WHERE c.id = messages.chat_id AND c.user_id = (SELECT auth.uid()))
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.chats c WHERE c.id = messages.chat_id AND c.user_id = (SELECT auth.uid()))
    );

DROP POLICY IF EXISTS "attachments_owner" ON public.attachments;
CREATE POLICY "attachments_owner" ON public.attachments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.chats c ON c.id = m.chat_id
            WHERE m.id = attachments.message_id AND c.user_id = (SELECT auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.messages m
            JOIN public.chats c ON c.id = m.chat_id
            WHERE m.id = attachments.message_id AND c.user_id = (SELECT auth.uid())
        )
    );

DROP POLICY IF EXISTS "guest_sessions_service_only" ON public.guest_sessions;
CREATE POLICY "guest_sessions_service_only" ON public.guest_sessions
    FOR ALL USING ((SELECT auth.role()) = 'service_role')
    WITH CHECK ((SELECT auth.role()) = 'service_role');

-- Storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage Policy
DROP POLICY IF EXISTS "storage_select_own" ON storage.objects;
DROP POLICY IF EXISTS "storage_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "storage_update_own" ON storage.objects;
DROP POLICY IF EXISTS "storage_delete_own" ON storage.objects;

DROP POLICY IF EXISTS "storage_select_own" ON storage.objects;
CREATE POLICY "storage_select_own" ON storage.objects FOR SELECT
USING (
    ((SELECT auth.uid()) IS NOT NULL AND split_part(name, '/', 1) = (SELECT auth.uid())::text)
    OR
    ((SELECT auth.uid()) IS NULL AND split_part(name, '/', 1) = 'guest' AND public.check_guest_token_from_path(name))
);

DROP POLICY IF EXISTS "storage_insert_own" ON storage.objects;
CREATE POLICY "storage_insert_own" ON storage.objects FOR INSERT
WITH CHECK (
    ((SELECT auth.uid()) IS NOT NULL AND split_part(name, '/', 1) = (SELECT auth.uid())::text)
    OR
    ((SELECT auth.uid()) IS NULL AND split_part(name, '/', 1) = 'guest' AND public.check_guest_token_from_path(name))
);

DROP POLICY IF EXISTS "storage_update_own" ON storage.objects;
CREATE POLICY "storage_update_own" ON storage.objects FOR UPDATE
USING ((SELECT auth.uid()) IS NOT NULL AND split_part(name, '/', 1) = (SELECT auth.uid())::text)
WITH CHECK ((SELECT auth.uid()) IS NOT NULL AND split_part(name, '/', 1) = (SELECT auth.uid())::text);

DROP POLICY IF EXISTS "storage_delete_own" ON storage.objects;
CREATE POLICY "storage_delete_own" ON storage.objects FOR DELETE
USING ((SELECT auth.uid()) IS NOT NULL AND split_part(name, '/', 1) = (SELECT auth.uid())::text);

-- Realtime
ALTER TABLE public.chats REPLICA IDENTITY FULL;
ALTER TABLE public.messages REPLICA IDENTITY FULL;

DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime
    FOR TABLE public.chats, public.messages;
