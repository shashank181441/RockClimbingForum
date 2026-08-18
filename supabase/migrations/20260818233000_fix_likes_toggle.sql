/*
  Fix likes: sync like_count on discussions/comments.

  Clients cannot UPDATE another author's discussion/comment under RLS,
  so like_count never changed after inserting into likes.
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
    -- Omit reaction_type_id (may be integer with DB default / FK)
    INSERT INTO likes (user_id, likeable_type, likeable_id)
    VALUES (v_user_id, p_likeable_type, p_likeable_id)
    ON CONFLICT (user_id, likeable_type, likeable_id) DO NOTHING;
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

-- Keep counts in sync for any direct likes table writes too
CREATE OR REPLACE FUNCTION public.sync_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.likeable_type = 'discussion' THEN
      UPDATE discussions
      SET like_count = (
        SELECT COUNT(*)::integer FROM likes
        WHERE likeable_type = 'discussion' AND likeable_id = NEW.likeable_id
      )
      WHERE id = NEW.likeable_id;
    ELSIF NEW.likeable_type = 'comment' THEN
      UPDATE comments
      SET like_count = (
        SELECT COUNT(*)::integer FROM likes
        WHERE likeable_type = 'comment' AND likeable_id = NEW.likeable_id
      )
      WHERE id = NEW.likeable_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.likeable_type = 'discussion' THEN
      UPDATE discussions
      SET like_count = (
        SELECT COUNT(*)::integer FROM likes
        WHERE likeable_type = 'discussion' AND likeable_id = OLD.likeable_id
      )
      WHERE id = OLD.likeable_id;
    ELSIF OLD.likeable_type = 'comment' THEN
      UPDATE comments
      SET like_count = (
        SELECT COUNT(*)::integer FROM likes
        WHERE likeable_type = 'comment' AND likeable_id = OLD.likeable_id
      )
      WHERE id = OLD.likeable_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS likes_sync_count ON likes;
CREATE TRIGGER likes_sync_count
AFTER INSERT OR DELETE ON likes
FOR EACH ROW EXECUTE FUNCTION public.sync_like_count();

-- One-time backfill so existing likes show correct counts
UPDATE discussions d
SET like_count = (
  SELECT COUNT(*)::integer FROM likes l
  WHERE l.likeable_type = 'discussion' AND l.likeable_id = d.id
);

UPDATE comments c
SET like_count = (
  SELECT COUNT(*)::integer FROM likes l
  WHERE l.likeable_type = 'comment' AND l.likeable_id = c.id
);
