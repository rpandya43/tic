-- Add grid_size column to live_games table
ALTER TABLE live_games 
ADD COLUMN grid_size integer NOT NULL DEFAULT 3;

-- Update the current_board column to handle larger grids
ALTER TABLE live_games 
ALTER COLUMN current_board TYPE text[] USING current_board::text[];

-- Add grid_size column to game_history table
ALTER TABLE game_history 
ADD COLUMN grid_size integer NOT NULL DEFAULT 3;

-- Update the moves column to handle larger grids
ALTER TABLE game_history 
ALTER COLUMN moves TYPE text[] USING moves::text[]; 