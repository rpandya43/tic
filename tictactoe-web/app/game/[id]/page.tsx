import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LiveGame from './LiveGame';

export default async function Game({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { spectate?: string };
}) {
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const { data: game } = await supabase
    .from('live_games')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!game) {
    redirect('/');
  }

  const isSpectator = searchParams.spectate === 'true';
  const isPlayer = game.player_x === session.user.id || game.player_o === session.user.id;

  if (!isSpectator && !isPlayer) {
    redirect('/');
  }

  const { data: players } = await supabase
    .from('presence')
    .select('*')
    .in('user_id', [game.player_x, game.player_o]);

  return (
    <main className="flex min-h-screen flex-col items-center p-6 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-purple-600/10 z-0" />
      <div className="relative z-10 w-full max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-bold text-white">
            {isSpectator ? 'Spectating Game' : 'Live Game'}
          </h1>
          <a
            href="/"
            className="btn-primary"
          >
            Back to Home
          </a>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <LiveGame
              gameId={params.id}
              currentUser={session.user}
              game={game}
              players={players || []}
              isSpectator={isSpectator}
            />
          </div>
          <div className="space-y-6">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 shadow-2xl">
              <h2 className="text-xl font-semibold text-gray-200 mb-4">Players</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-blue-400 font-medium">Player X</p>
                    <p className="text-sm text-gray-400">
                      {players?.find(p => p.user_id === game.player_x)?.username || 'Loading...'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-400 font-medium">Player O</p>
                    <p className="text-sm text-gray-400">
                      {players?.find(p => p.user_id === game.player_o)?.username || 'Loading...'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {isSpectator && (
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 shadow-2xl">
                <h2 className="text-xl font-semibold text-gray-200 mb-4">Spectator Mode</h2>
                <p className="text-gray-400">
                  You are watching this game. Players will be notified of spectators.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
} 