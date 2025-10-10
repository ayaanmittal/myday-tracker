-- Fix missing attendance_sync_state table
CREATE TABLE IF NOT EXISTS attendance_sync_state (
  id INT PRIMARY KEY DEFAULT 1,
  last_record TEXT,
  last_sync_at TIMESTAMPTZ
);

INSERT INTO attendance_sync_state (id) VALUES (1) 
ON CONFLICT (id) DO NOTHING;
