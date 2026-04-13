-- Completely drop and recreate the docs table
DROP TABLE IF EXISTS docs CASCADE;

-- Create fresh table
CREATE TABLE docs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE docs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "docs_select" ON docs FOR SELECT TO authenticated USING (true);
CREATE POLICY "docs_insert" ON docs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "docs_delete" ON docs FOR DELETE TO authenticated USING (true);

-- Create indexes
CREATE INDEX idx_docs_category ON docs(category);
CREATE INDEX idx_docs_created_at ON docs(created_at DESC);

-- Force immediate schema reload
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';
