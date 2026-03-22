-- Drop old section_num constraint (was 1-8 only)
ALTER TABLE unit_files DROP CONSTRAINT IF EXISTS unit_files_section_num_check;
ALTER TABLE unit_files ADD CONSTRAINT unit_files_section_num_check CHECK (section_num between 0 and 99);

-- Create unit_sections table for dynamic section management
CREATE TABLE IF NOT EXISTS unit_sections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  unit_id text NOT NULL,
  unit_name text,
  section_name text NOT NULL,
  section_order int DEFAULT 0,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT unit_sections_unique UNIQUE(unit_id, section_name)
);

ALTER TABLE unit_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read sections"
  ON unit_sections FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage sections"
  ON unit_sections FOR ALL TO authenticated
  USING ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM profiles WHERE id = auth.uid()) = 'admin');
