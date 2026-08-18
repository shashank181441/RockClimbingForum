/*
  Seed a default reaction if needed, then recreate toggle_like using a real FK id.
*/

-- Ensure at least one reaction type exists (adjust if your columns differ)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'reaction_types'
  ) AND NOT EXISTS (SELECT 1 FROM reaction_types LIMIT 1) THEN
    BEGIN
      INSERT INTO reaction_types (id, name) VALUES (1, 'like');
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        INSERT INTO reaction_types (name) VALUES ('like');
      EXCEPTION WHEN OTHERS THEN
        NULL; -- schema unknown; user may need to seed manually
      END;
    END;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.toggle_like(
  p_likeable_type text,
  p_likeable_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_liked boolean;
  v_count integer;
  v_reaction_id integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_likeable_type NOT IN ('discussion', 'comment') THEN
    RAISE EXCEPTION 'Invalid likeable_type: %', p_likeable_type;
  END IF;

  -- Pick any valid reaction_types.id for the FK
  SELECT id INTO v_reaction_id
  FROM reaction_types
  ORDER BY id
  LIMIT 1;

  IF v_reaction_id IS NULL THEN
    RAISE EXCEPTION 'No rows in reaction_types. Insert one row (e.g. like) then try again.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM likes
    WHERE user_id = v_user_id
      AND likeable_type::text = p_likeable_type
      AND likeable_id = p_likeable_id
  ) THEN
    DELETE FROM likes
    WHERE user_id = v_user_id
      AND likeable_type::text = p_likeable_type
      AND likeable_id = p_likeable_id;
    v_liked := false;
  ELSE
    INSERT INTO likes (user_id, likeable_type, likeable_id, reaction_type_id)
    VALUES (v_user_id, p_likeable_type, p_likeable_id, v_reaction_id)
    ON CONFLICT DO NOTHING;
    v_liked := true;
  END IF;

  IF p_likeable_type = 'discussion' THEN
    UPDATE discussions
    SET like_count = (
      SELECT COUNT(*)::integer FROM likes
      WHERE likeable_type::text = 'discussion' AND likeable_id = p_likeable_id
    )
    WHERE id = p_likeable_id
    RETURNING like_count INTO v_count;
  ELSIF p_likeable_type = 'comment' THEN
    UPDATE comments
    SET like_count = (
      SELECT COUNT(*)::integer FROM likes
      WHERE likeable_type::text = 'comment' AND likeable_id = p_likeable_id
    )
    WHERE id = p_likeable_id
    RETURNING like_count INTO v_count;
  END IF;

  RETURN jsonb_build_object(
    'liked', v_liked,
    'like_count', COALESCE(v_count, 0)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_like(text, uuid) TO authenticated;
