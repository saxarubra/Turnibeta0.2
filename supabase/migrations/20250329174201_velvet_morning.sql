-- Clear all existing data
TRUNCATE TABLE shifts_schedule CASCADE;
TRUNCATE TABLE shift_swaps_v2 CASCADE;
TRUNCATE TABLE notifications CASCADE;

-- Drop existing function
DROP FUNCTION IF EXISTS generate_shifts_for_week CASCADE;

-- Recreate shifts_schedule table
DROP TABLE IF EXISTS shifts_schedule;
CREATE TABLE shifts_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date date NOT NULL,
  employee_code text NOT NULL,
  sunday_shift text,
  monday_shift text,
  tuesday_shift text,
  wednesday_shift text,
  thursday_shift text,
  friday_shift text,
  saturday_shift text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE shifts_schedule ENABLE ROW LEVEL SECURITY;

-- Create indexes for better performance
CREATE INDEX idx_shifts_schedule_week ON shifts_schedule(week_start_date);
CREATE INDEX idx_shifts_schedule_employee ON shifts_schedule(employee_code);

-- Create policies
CREATE POLICY "Anyone can read shifts schedule"
  ON shifts_schedule
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can insert shifts schedule"
  ON shifts_schedule
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Anyone can delete shifts schedule"
  ON shifts_schedule
  FOR DELETE
  TO authenticated
  USING (true);