-- Lixeira: permite que o dono veja seus próprios registros soft-deletados (listas e itens).
-- As políticas SELECT existentes escondem deleted_at IS NULL para todos; estas novas
-- somam (OR) o acesso do dono aos seus próprios registros na lixeira.

-- wish_lists: dono pode ver suas listas excluídas
DROP POLICY IF EXISTS "Owner can view own trashed lists" ON public.wish_lists;
CREATE POLICY "Owner can view own trashed lists" ON public.wish_lists
  FOR SELECT TO authenticated USING (
    deleted_at IS NOT NULL AND owner_id = auth.uid()
  );

-- wish_lists: dono pode restaurar (UPDATE deleted_at = NULL) suas listas excluídas.
-- A política "Owner updates list" já cobre UPDATE via owner_id = auth.uid(), mas ela
-- não restringe por deleted_at, então o dono já consegue restaurar. Nenhuma mudança extra.

-- wish_items: dono pode ver seus itens excluídos
DROP POLICY IF EXISTS "Owner can view own trashed items" ON public.wish_items;
CREATE POLICY "Owner can view own trashed items" ON public.wish_items
  FOR SELECT TO authenticated USING (
    deleted_at IS NOT NULL AND user_id = auth.uid()
  );

-- wish_items: dono pode restaurar seus itens excluídos.
-- A política "Update items if can edit list" exige can_edit_list(list_id), mas a
-- função can_edit_list não filtra deleted_at — na verdade funciona para listas ativas.
-- Para itens na lixeira cuja lista também foi excluída, can_edit_list falha. Adicionamos
-- uma política extra (somada via OR) que permite ao dono do item restaurá-lo.
DROP POLICY IF EXISTS "Owner updates own trashed items" ON public.wish_items;
CREATE POLICY "Owner updates own trashed items" ON public.wish_items
  FOR UPDATE TO authenticated USING (
    deleted_at IS NOT NULL AND user_id = auth.uid()
  ) WITH CHECK (
    user_id = auth.uid()
  );

-- Hard-delete autorizado ao dono (para "excluir definitivamente" na Lixeira).
-- A política "Delete items if can edit list" não funciona para itens na lixeira (lista
-- também pode estar excluída), então adicionamos uma específica para o dono.
DROP POLICY IF EXISTS "Owner deletes own items" ON public.wish_items;
CREATE POLICY "Owner deletes own items" ON public.wish_items
  FOR DELETE TO authenticated USING (
    user_id = auth.uid()
  );

-- Hard-delete de listas: a política "Owner deletes list" já existe (owner_id = auth.uid()),
-- sem filtro de deleted_at, então o dono já consegue excluir definitivamente da lixeira.
-- Nenhuma mudança extra necessária para listas.

-- Cron de purge: remove definitivamente registros na lixeira há mais de 30 dias.
-- Requer a extensão pg_cron (disponível no Supabase cloud).
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Marca o job como inseguro? Não — usamos SECURITY DEFINER via função para evitar
-- problemas de permissão do cron ao acessar tabelas com RLS.
CREATE OR REPLACE FUNCTION public.purge_trash()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Remove itens na lixeira há mais de 30 dias
  DELETE FROM public.wish_items
    WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';

  -- Remove listas na lixeira há mais de 30 dias (CASCADE remove membros e itens restantes)
  DELETE FROM public.wish_lists
    WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
END;
$$;

REVOKE ALL ON FUNCTION public.purge_trash() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.purge_trash() TO authenticated;

-- Agenda para rodar diariamente às 03:00 UTC.
SELECT cron.schedule(
  'purge-trash-daily',
  '0 3 * * *',
  $$SELECT public.purge_trash();$$
);
