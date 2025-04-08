/*
  # Add admin swap policies
  
  1. Changes
    - Add policies for admin to manage all swaps
    - Remove restrictions on swap types for admin
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create swap requests" ON shift_swaps_v2;
DROP POLICY IF EXISTS "Users can view swap requests" ON shift_swaps_v2;
DROP POLICY IF EXISTS "Users can update swap requests" ON shift_swaps_v2;
DROP POLICY IF EXISTS "Admins can delete all swaps" ON shift_swaps_v2;

-- Create comprehensive policies for shift_swaps_v2
CREATE POLICY "Users can create swap requests"
  ON shift_swaps_v2
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Admin can create any swap
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    ) OR
    -- Regular users can only create their own swaps
    from_employee = (
      SELECT full_name 
      FROM users 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can view swap requests"
  ON shift_swaps_v2
  FOR SELECT
  TO authenticated
  USING (
    -- Admin can view all swaps
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    ) OR
    -- Users can see swaps they're involved in
    from_employee = (
      SELECT full_name 
      FROM users 
      WHERE id = auth.uid()
    ) OR
    to_employee = (
      SELECT full_name 
      FROM users 
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update swap requests"
  ON shift_swaps_v2
  FOR UPDATE
  TO authenticated
  USING (
    -- Admin can update any swap
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    ) OR
    -- Regular users can only update their own pending swaps
    (
      (
        -- Target employee can accept/reject pending requests
        to_employee = (
          SELECT full_name 
          FROM users 
          WHERE id = auth.uid()
        ) AND 
        status = 'pending'
      ) OR
      -- Requesting employee can cancel their pending requests
      (
        from_employee = (
          SELECT full_name 
          FROM users 
          WHERE id = auth.uid()
        ) AND 
        status = 'pending'
      )
    )
  );

CREATE POLICY "Admins can delete swaps"
  ON shift_swaps_v2
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );