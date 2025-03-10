-- Add grid_size column to live_games table
ALTER TABLE live_games 
ADD COLUMN grid_size integer NOT NULL DEFAULT 3;

-- Update the current_board column to handle larger grids
ALTER TABLE live_games 
ALTER COLUMN current_board TYPE text[] USING current_board::text[];

-- Create game_history table if it doesn't exist
CREATE TABLE IF NOT EXISTS game_history (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
    winner text,
    moves text[],
    grid_size integer NOT NULL DEFAULT 3,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS policies for game_history
ALTER TABLE game_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own game history"
    ON game_history
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own game history"
    ON game_history
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create index for faster queries
CREATE INDEX game_history_user_id_idx ON game_history(user_id);

-- Add grid_size column to game_history table
ALTER TABLE game_history 
ADD COLUMN grid_size integer NOT NULL DEFAULT 3;

-- Update the moves column to handle larger grids
ALTER TABLE game_history 
ALTER COLUMN moves TYPE text[] USING moves::text[]; 