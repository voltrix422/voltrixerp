-- Force PostgREST to reload the schema cache
-- Run this if you get "Could not find the table in the schema cache" errors

-- Method 1: Send reload notification
NOTIFY pgrst, 'reload schema';

-- Method 2: If above doesn't work, restart PostgREST from Supabase dashboard
-- Go to: Project Settings > API > Restart PostgREST

-- Method 3: Verify the table exists
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'erp_documents';

-- Method 4: Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'erp_documents';
