CREATE TABLE IF NOT EXISTS report_snapshots (
  id SERIAL PRIMARY KEY,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  report_data JSONB NOT NULL,
  attendance_matrix JSONB,
  absent_table JSONB,
  holiday_table JSONB,
  generated_by INTEGER NULL REFERENCES admins(id) ON DELETE SET NULL,
  generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(month, year)
);
