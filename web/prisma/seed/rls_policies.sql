CREATE EXTENSION IF NOT EXISTS "pgcrypto";

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_id_fkey
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, updated_at)
  VALUES (NEW.id, NEW.email, NOW())
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.sync_profile_email()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_email_update ON auth.users;
CREATE TRIGGER on_auth_user_email_update
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_email();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;

CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chats_owner" ON public.chats;

CREATE POLICY "chats_owner"
  ON public.chats FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_owner" ON public.messages;

CREATE POLICY "messages_owner"
  ON public.messages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = messages.chat_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chats c
      WHERE c.id = messages.chat_id
        AND c.user_id = auth.uid()
    )
  );

ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attachments_owner" ON public.attachments;

CREATE POLICY "attachments_owner"
  ON public.attachments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.chats c ON c.id = m.chat_id
      WHERE m.id = attachments.message_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.messages m
      JOIN public.chats c ON c.id = m.chat_id
      WHERE m.id = attachments.message_id
        AND c.user_id = auth.uid()
    )
  );

ALTER TABLE public.guest_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guest_sessions_service_only" ON public.guest_sessions;

CREATE POLICY "guest_sessions_service_only"
  ON public.guest_sessions FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

INSERT INTO storage.buckets (id, name, public)
VALUES ('attachments', 'attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "storage_select_own" ON storage.objects;
DROP POLICY IF EXISTS "storage_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "storage_update_own" ON storage.objects;
DROP POLICY IF EXISTS "storage_delete_own" ON storage.objects;

CREATE POLICY "storage_select_own"
  ON storage.objects FOR SELECT
  USING (split_part(name, '/', 1) = auth.uid()::text);

CREATE POLICY "storage_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (split_part(name, '/', 1) = auth.uid()::text);

CREATE POLICY "storage_update_own"
  ON storage.objects FOR UPDATE
  USING (split_part(name, '/', 1) = auth.uid()::text)
  WITH CHECK (split_part(name, '/', 1) = auth.uid()::text);

CREATE POLICY "storage_delete_own"
  ON storage.objects FOR DELETE
  USING (split_part(name, '/', 1) = auth.uid()::text);

DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime
  FOR TABLE public.chats, public.messages;