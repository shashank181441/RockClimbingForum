/*
  toggle_like without depending on likeable_type enum
  (some projects store likeable_type as plain text).
*/

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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_likeable_type NOT IN ('discussion', 'comment') THEN
    RAISE EXCEPTION 'Invalid likeable_type: %', p_likeable_type;
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
    BEGIN
      INSERT INTO likes (user_id, likeable_type, likeable_id)
      VALUES (v_user_id, p_likeable_type, p_likeable_id)
      ON CONFLICT DO NOTHING;
    EXCEPTION
      WHEN not_null_violation OR foreign_key_violation OR invalid_text_representation THEN
        INSERT INTO likes (user_id, likeable_type, likeable_id, reaction_type_id)
        VALUES (v_user_id, p_likeable_type, p_likeable_id, 1)
        ON CONFLICT DO NOTHING;
      WHEN unique_violation THEN
        NULL; -- already liked
    END;
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

-- Drop old signature if it was created with an enum param
DO $$
BEGIN
  DROP FUNCTION IF EXISTS public.toggle_like(likeable_type, uuid);
EXCEPTION
  WHEN undefined_object OR undefined_function THEN
    NULL;
END $$;
