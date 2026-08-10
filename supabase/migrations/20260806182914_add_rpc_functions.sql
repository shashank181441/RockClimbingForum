/*
# Add RPC helper functions

1. New Functions
- increment_view_count(disc_id): increments view_count on a discussion by 1
- increment_reply_count(comment_id): increments reply_count on a comment by 1

2. Security
- SECURITY DEFINER so they can run even if RLS would block a plain UPDATE.
- Simple increment operations, safe to expose.
*/

CREATE OR REPLACE FUNCTION public.increment_view_count(disc_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE discussions SET view_count = view_count + 1 WHERE id = disc_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.increment_reply_count(comment_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE comments SET reply_count = reply_count + 1 WHERE id = comment_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
