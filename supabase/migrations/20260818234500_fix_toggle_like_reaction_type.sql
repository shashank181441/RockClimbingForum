/*
  Fix: production reaction_type_id is integer — never insert the string 'like'.
*/

CREATE OR REPLACE FUNCTION public.toggle_like(
  p_likeable_type likeable_type,
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (
    SELECT 1 FROM likes
    WHERE user_id = v_user_id
      AND likeable_type = p_likeable_type
      AND likeable_id = p_likeable_id
  ) THEN
    DELETE FROM likes
    WHERE user_id = v_user_id
      AND likeable_type = p_likeable_type
      AND likeable_id = p_likeable_id;
    v_liked := false;
  ELSE
    BEGIN
      -- Prefer DB default for reaction_type_id
      INSERT INTO likes (user_id, likeable_type, likeable_id)
      VALUES (v_user_id, p_likeable_type, p_likeable_id)
      ON CONFLICT (user_id, likeable_type, likeable_id) DO NOTHING;
    EXCEPTION
      WHEN not_null_violation OR foreign_key_violation THEN
        -- Integer FK/default: use 1 as the "like" reaction
        INSERT INTO likes (user_id, likeable_type, likeable_id, reaction_type_id)
        VALUES (v_user_id, p_likeable_type, p_likeable_id, 1)
        ON CONFLICT (user_id, likeable_type, likeable_id) DO NOTHING;
    END;
    v_liked := true;
  END IF;

  IF p_likeable_type = 'discussion' THEN
    UPDATE discussions
    SET like_count = (
      SELECT COUNT(*)::integer FROM likes
      WHERE likeable_type = 'discussion' AND likeable_id = p_likeable_id
    )
    WHERE id = p_likeable_id
    RETURNING like_count INTO v_count;
  ELSIF p_likeable_type = 'comment' THEN
    UPDATE comments
    SET like_count = (
      SELECT COUNT(*)::integer FROM likes
      WHERE likeable_type = 'comment' AND likeable_id = p_likeable_id
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

GRANT EXECUTE ON FUNCTION public.toggle_like(likeable_type, uuid) TO authenticated;
