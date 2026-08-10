-- Add soft-delete support to wish_lists
ALTER TABLE public.wish_lists ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_wish_lists_deleted_at ON public.wish_lists(deleted_at) WHERE deleted_at IS NULL;

-- Add soft-delete support to wish_items
ALTER TABLE public.wish_items ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;
CREATE INDEX IF NOT EXISTS idx_wish_items_deleted_at ON public.wish_items(deleted_at) WHERE deleted_at IS NULL;

-- Add icon support to wish_lists
ALTER TABLE public.wish_lists ADD COLUMN IF NOT EXISTS icon TEXT;

-- Add avatar_url support to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add policy: hide soft-deleted lists from view policies
DROP POLICY IF EXISTS "View lists you can access" ON public.wish_lists;
CREATE POLICY "View lists you can access" ON public.wish_lists
FOR SELECT TO authenticated USING (deleted_at IS NULL AND public.can_view_list(id, auth.uid()));

-- Add policy: hide soft-deleted items from view policies
DROP POLICY IF EXISTS "View items of accessible lists" ON public.wish_items;
CREATE POLICY "View items of accessible lists" ON public.wish_items
FOR SELECT TO authenticated USING (
  deleted_at IS NULL AND list_id IS NOT NULL AND public.can_view_list(list_id, auth.uid())
);
