-- Create match_history table
CREATE TABLE match_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  winner TEXT NOT NULL CHECK (winner IN ('X', 'O')),
  moves JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Add RLS policies
ALTER TABLE match_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own match history"
  ON match_history
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own match history"
  ON match_history
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add function to delete all stats and match history
CREATE OR REPLACE FUNCTION reset_user_stats(user_id_param UUID)
RETURNS void AS $$
BEGIN
  DELETE FROM game_stats WHERE user_id = user_id_param;
  DELETE FROM match_history WHERE user_id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 