CREATE OR REPLACE FUNCTION public.create_wish_list(_name text, _visibility text DEFAULT 'public')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_list_id uuid;
  current_user_id uuid;
  cleaned_name text;
  cleaned_visibility text;
BEGIN
  current_user_id := auth.uid();

  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  cleaned_name := NULLIF(btrim(_name), '');
  IF cleaned_name IS NULL THEN
    RAISE EXCEPTION 'list name is required';
  END IF;

  cleaned_visibility := COALESCE(NULLIF(btrim(_visibility), ''), 'public');
  IF cleaned_visibility NOT IN ('private', 'public', 'specific') THEN
    RAISE EXCEPTION 'invalid visibility: %', cleaned_visibility;
  END IF;

  INSERT INTO public.wish_lists (owner_id, name, visibility)
  VALUES (current_user_id, cleaned_name, cleaned_visibility)
  RETURNING id INTO new_list_id;

  RETURN new_list_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_wish_list(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_wish_list(text, text) TO authenticated;