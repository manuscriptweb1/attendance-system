-- Add theme_preference column
ALTER TABLE admins
ADD COLUMN IF NOT EXISTS theme_preference VARCHAR(10) DEFAULT 'dark';

-- Update existing records
UPDATE admins
SET theme_preference = 'dark'
WHERE theme_preference IS NULL
   OR theme_preference NOT IN ('dark', 'light');

-- Set not null constraint
ALTER TABLE admins
ALTER COLUMN theme_preference SET NOT NULL;

-- Add check constraint for allowed values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'admins_theme_preference_check'
  ) THEN
    ALTER TABLE admins
    ADD CONSTRAINT admins_theme_preference_check
    CHECK (theme_preference IN ('dark', 'light'));
  END IF;
END $$;
