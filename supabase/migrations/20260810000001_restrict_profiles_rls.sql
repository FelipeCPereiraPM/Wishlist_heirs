-- Funcao: verifica se o viewer pode ver o perfil de um usuario
-- Regra: pode ver se for o proprio perfil, ou se o usuario tem lista publica/compartilhada
CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_user_id UUID, _viewer_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _profile_user_id = _viewer_id
  OR EXISTS (
    SELECT 1 FROM public.wish_lists l
    WHERE l.owner_id = _profile_user_id 
      AND l.deleted_at IS NULL
      AND (
        l.visibility = 'public'
        OR EXISTS (
          SELECT 1 FROM public.wish_list_members m 
          WHERE m.list_id = l.id AND m.user_id = _viewer_id
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.can_view_profile(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_profile(UUID, UUID) TO authenticated;

-- Substitui politica antiga (todos veem todos) pela nova (so ve perfis acessiveis)
DROP POLICY IF EXISTS "Anyone authenticated can view profiles" ON public.profiles;

CREATE POLICY "View accessible profiles" ON public.profiles
FOR SELECT TO authenticated USING (public.can_view_profile(user_id, auth.uid()));
