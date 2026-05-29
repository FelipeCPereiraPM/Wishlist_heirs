CREATE TABLE public.wish_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  link TEXT,
  category TEXT NOT NULL CHECK (category IN ('para_mim', 'para_casa')),
  purchased BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.wish_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all items"
  ON public.wish_items FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can insert own items"
  ON public.wish_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own items"
  ON public.wish_items FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own items"
  ON public.wish_items FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX idx_wish_items_user_id ON public.wish_items(user_id);