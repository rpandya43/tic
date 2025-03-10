-- Create presence table
create table public.presence (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade,
  username text,
  status text check (status in ('online', 'in_game', 'idle')),
  current_game_id uuid,
  last_seen timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Create game challenges table
create table public.game_challenges (
  id uuid primary key default uuid_generate_v4(),
  challenger_id uuid references auth.users(id) on delete cascade,
  challenged_id uuid references auth.users(id) on delete cascade,
  status text check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamp with time zone default now()
);

-- Create live games table
create table public.live_games (
  id uuid primary key default uuid_generate_v4(),
  player_x uuid references auth.users(id),
  player_o uuid references auth.users(id),
  current_board text[] default array_fill(null::text, array[9]),
  current_player text default 'X',
  winner text,
  spectator_count integer default 0,
  spectators uuid[] default array[]::uuid[],
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Add RLS policies
alter table public.presence enable row level security;
alter table public.game_challenges enable row level security;
alter table public.live_games enable row level security;

-- Presence policies
create policy "Users can see all presence data"
  on public.presence for select
  to authenticated
  using (true);

create policy "Users can insert their own presence"
  on public.presence for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "Users can update their own presence"
  on public.presence for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Game challenges policies
create policy "Users can see their challenges"
  on public.game_challenges for select
  to authenticated
  using (auth.uid() in (challenger_id, challenged_id));

create policy "Users can create challenges"
  on public.game_challenges for insert
  to authenticated
  with check (auth.uid() = challenger_id);

create policy "Users can update their challenges"
  on public.game_challenges for update
  to authenticated
  using (auth.uid() in (challenger_id, challenged_id))
  with check (auth.uid() in (challenger_id, challenged_id));

-- Live games policies
create policy "Anyone can view live games"
  on public.live_games for select
  to authenticated
  using (true);

create policy "Players can insert games"
  on public.live_games for insert
  to authenticated
  with check (auth.uid() in (player_x, player_o));

create policy "Players can update their games"
  on public.live_games for update
  to authenticated
  using (auth.uid() in (player_x, player_o))
  with check (auth.uid() in (player_x, player_o));

-- Function to update presence
create or replace function public.handle_presence()
returns trigger as $$
begin
  update public.presence
  set last_seen = now()
  where user_id = auth.uid();
  return new;
end;
$$ language plpgsql security definer;

-- Function to clean up old presence
create or replace function public.cleanup_presence()
returns void as $$
begin
  delete from public.presence
  where last_seen < now() - interval '5 minutes';
end;
$$ language plpgsql security definer; 