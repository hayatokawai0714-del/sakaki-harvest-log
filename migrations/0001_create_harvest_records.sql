CREATE TABLE IF NOT EXISTS harvest_records (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  field TEXT NOT NULL,
  grade TEXT NOT NULL,
  weights TEXT NOT NULL DEFAULT '[]',
  total_weight REAL NOT NULL DEFAULT 0,
  user TEXT NOT NULL,
  memo TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_harvest_records_date ON harvest_records(date);
CREATE INDEX IF NOT EXISTS idx_harvest_records_field ON harvest_records(field);
CREATE INDEX IF NOT EXISTS idx_harvest_records_grade ON harvest_records(grade);
