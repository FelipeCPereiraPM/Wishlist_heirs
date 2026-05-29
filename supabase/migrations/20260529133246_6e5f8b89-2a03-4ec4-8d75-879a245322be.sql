-- 1. Lists table
CREATE TABLE public.wish_lists (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.wish_list_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  list_id UUID NOT NULL REFERENCES public.wish_lists(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'viewer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (list_id, user_id)
);

ALTER TABLE public.wish_items ADD COLUMN list_id UUID REFERENCES public.wish_lists(id) ON DELETE CASCADE;

-- Validation trigger for visibility / role values
CREATE OR REPLACE FUNCTION public.validate_list_visibility()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.visibility NOT IN ('private','public','specific') THEN
    RAISE EXCEPTION 'invalid visibility: %', NEW.visibility;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_list_visibility
BEFORE INSERT OR UPDATE ON public.wish_lists
FOR EACH ROW EXECUTE FUNCTION public.validate_list_visibility();

CREATE OR REPLACE FUNCTION public.validate_member_role()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.role NOT IN ('viewer','editor') THEN
    RAISE EXCEPTION 'invalid role: %', NEW.role;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_member_role
BEFORE INSERT OR UPDATE ON public.wish_list_members
FOR EACH ROW EXECUTE FUNCTION public.validate_member_role();

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.can_view_list(_list_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.wish_lists l
    WHERE l.id = _list_id
      AND (
        l.owner_id = _user_id
        OR l.visibility = 'public'
        OR EXISTS (
          SELECT 1 FROM public.wish_list_members m
          WHERE m.list_id = _list_id AND m.user_id = _user_id
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_edit_list(_list_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.wish_lists l
    WHERE l.id = _list_id AND l.owner_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.wish_list_members m
    WHERE m.list_id = _list_id AND m.user_id = _user_id AND m.role = 'editor'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_list_owner(_list_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.wish_lists l
    WHERE l.id = _list_id AND l.owner_id = _user_id
  )
$$;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wish_lists TO authenticated;
GRANT ALL ON public.wish_lists TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wish_list_members TO authenticated;
GRANT ALL ON public.wish_list_members TO service_role;

-- RLS
ALTER TABLE public.wish_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wish_list_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "View lists you can access" ON public.wish_lists
FOR SELECT TO authenticated USING (public.can_view_list(id, auth.uid()));

CREATE POLICY "Create own lists" ON public.wish_lists
FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owner updates list" ON public.wish_lists
FOR UPDATE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "Owner deletes list" ON public.wish_lists
FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "View memberships of accessible lists" ON public.wish_list_members
FOR SELECT TO authenticated USING (
  user_id = auth.uid() OR public.is_list_owner(list_id, auth.uid())
);

CREATE POLICY "Owner adds members" ON public.wish_list_members
FOR INSERT TO authenticated WITH CHECK (public.is_list_owner(list_id, auth.uid()));

CREATE POLICY "Owner updates members" ON public.wish_list_members
FOR UPDATE TO authenticated USING (public.is_list_owner(list_id, auth.uid()));

CREATE POLICY "Owner removes members" ON public.wish_list_members
FOR DELETE TO authenticated USING (public.is_list_owner(list_id, auth.uid()));

-- Migrate existing items into a default public list per user
DO $$
DECLARE
  r RECORD;
  new_list UUID;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.wish_items WHERE list_id IS NULL LOOP
    INSERT INTO public.wish_lists (owner_id, name, visibility)
    VALUES (r.user_id, 'Minha lista', 'public')
    RETURNING id INTO new_list;
    UPDATE public.wish_items SET list_id = new_list WHERE user_id = r.user_id AND list_id IS NULL;
  END LOOP;
END $$;

-- Replace wish_items policies to be list-based
DROP POLICY IF EXISTS "Authenticated users can read all items" ON public.wish_items;
DROP POLICY IF EXISTS "Users can delete own items" ON public.wish_items;
DROP POLICY IF EXISTS "Users can insert own items" ON public.wish_items;
DROP POLICY IF EXISTS "Users can update own items" ON public.wish_items;

CREATE POLICY "View items of accessible lists" ON public.wish_items
FOR SELECT TO authenticated USING (
  list_id IS NOT NULL AND public.can_view_list(list_id, auth.uid())
);

CREATE POLICY "Edit items if can edit list" ON public.wish_items
FOR INSERT TO authenticated WITH CHECK (
  user_id = auth.uid() AND list_id IS NOT NULL AND public.can_edit_list(list_id, auth.uid())
);

CREATE POLICY "Update items if can edit list" ON public.wish_items
FOR UPDATE TO authenticated USING (
  list_id IS NOT NULL AND public.can_edit_list(list_id, auth.uid())
);

CREATE POLICY "Delete items if can edit list" ON public.wish_items
FOR DELETE TO authenticated USING (
  list_id IS NOT NULL AND public.can_edit_list(list_id, auth.uid())
);