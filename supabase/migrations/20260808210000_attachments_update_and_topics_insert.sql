-- Bootstrap-friendly writes: any authenticated user can create categories & topics.
-- Update/delete remain admin/moderator only.

-- CATEGORIES
DROP POLICY IF EXISTS "categories_admin_write" ON categories;

DROP POLICY IF EXISTS "categories_authed_insert" ON categories;
CREATE POLICY "categories_authed_insert" ON categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "categories_admin_update" ON categories;
CREATE POLICY "categories_admin_update" ON categories FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  );

DROP POLICY IF EXISTS "categories_admin_delete" ON categories;
CREATE POLICY "categories_admin_delete" ON categories FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  );

-- TOPICS
DROP POLICY IF EXISTS "topics_admin_write" ON topics;

DROP POLICY IF EXISTS "topics_authed_insert" ON topics;
CREATE POLICY "topics_authed_insert" ON topics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

DROP POLICY IF EXISTS "topics_admin_update" ON topics;
CREATE POLICY "topics_admin_update" ON topics FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  );

DROP POLICY IF EXISTS "topics_admin_delete" ON topics;
CREATE POLICY "topics_admin_delete" ON topics FOR DELETE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM user_roles ur WHERE ur.user_id = auth.uid() AND ur.role IN ('admin','moderator'))
  );

-- Optional: owners can update attachment rows (for insert-then-link flows)
DROP POLICY IF EXISTS "attachments_owner_update" ON attachments;
CREATE POLICY "attachments_owner_update" ON attachments FOR UPDATE
  TO authenticated
  USING (auth.uid() = uploader_id)
  WITH CHECK (auth.uid() = uploader_id);
