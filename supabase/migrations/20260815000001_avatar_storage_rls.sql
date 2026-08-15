-- Bucket de avatares: PUBLIC para leitura (URL pública permanente, padrão GitHub/Twitter),
-- RLS no upload garante que só o dono escreve em sua própria pasta (user_id/*).
-- Idempotente: pode ser executada múltiplas vezes sem erro.

-- 1. Cria o bucket 'avatars' como público se não existir.
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE
SET public = true;

-- 2. Policy: leitura pública — qualquer um (mesmo anônimo) pode ler objetos do bucket.
DROP POLICY IF EXISTS "Public read avatars" ON storage.objects;
CREATE POLICY "Public read avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

-- 3. Policy: upload/insert — só o dono escreve em sua pasta (caminho começa com auth.uid()/).
DROP POLICY IF EXISTS "Owner upload avatar" ON storage.objects;
CREATE POLICY "Owner upload avatar" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. Policy: update — só o dono atualiza seus avatares.
DROP POLICY IF EXISTS "Owner update avatar" ON storage.objects;
CREATE POLICY "Owner update avatar" ON storage.objects
  FOR UPDATE TO authenticated USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  ) WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 5. Policy: delete — só o dono remove seus avatares.
DROP POLICY IF EXISTS "Owner delete avatar" ON storage.objects;
CREATE POLICY "Owner delete avatar" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
