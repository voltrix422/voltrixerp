-- Drop old table if exists
DROP TABLE IF EXISTS erp_documents CASCADE;

-- Create documents table with simpler name
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

-- RLS Policies
CREATE POLICY "Allow authenticated users to read docs"
  ON docs FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow authenticated users to insert docs"
  ON docs FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated users to delete docs"
  ON docs FOR DELETE
  TO authenticated
  USING (true);

-- Create index
CREATE INDEX idx_docs_category ON docs(category);
CREATE INDEX idx_docs_created_at ON docs(created_at DESC);

-- Force schema reload
NOTIFY pgrst, 'reload schema';
