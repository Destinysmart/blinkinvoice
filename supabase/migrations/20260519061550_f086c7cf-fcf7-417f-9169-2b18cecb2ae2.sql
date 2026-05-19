-- Enable RLS on realtime.messages (it's already enabled by default in newer Supabase, but ensure)
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

-- Drop any existing permissive policies
DROP POLICY IF EXISTS "authenticated_can_subscribe_own_topic" ON realtime.messages;
DROP POLICY IF EXISTS "authenticated_no_broadcast" ON realtime.messages;

-- Allow authenticated users to subscribe ONLY to a channel topic matching their own user id
CREATE POLICY "authenticated_can_subscribe_own_topic"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() = (SELECT auth.uid()::text))
);

-- Block all writes (broadcast/presence sends) — app uses postgres_changes only
CREATE POLICY "authenticated_no_broadcast"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (false);