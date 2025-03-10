import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import GameBoard from '../components/GameBoard';
import ResetStatsButton from './ResetStatsButton';

export default async function Stats() {
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  const [{ data: stats }, { data: matches }] = await Promise.all([
    supabase
      .from('game_stats')
      .select('*')
      .eq('user_id', session.user.id)
      .single(),
    supabase
      .from('match_history')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(10)
  ]);

  return (
    <main className="flex min-h-screen flex-col items-center p-6 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-purple-600/10 z-0" />
      <div className="relative z-10 w-full max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-bold text-white">Game Stats</h1>
          <div className="flex gap-4">
            <Link
              href="/"
              className="btn-primary"
            >
              Back to Game
            </Link>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="btn-danger"
              >
                Sign Out
              </button>
            </form>
          </div>
        </div>
        
        <div className="grid gap-8">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 shadow-2xl">
            <div className="text-center">
              <p className="text-2xl font-semibold text-gray-200 mb-2">Total Wins</p>
              <p className="text-5xl font-bold text-blue-400">{stats?.wins || 0}</p>
            </div>
          </div>

          {matches && matches.length > 0 && (
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 shadow-2xl">
              <h2 className="text-2xl font-semibold text-gray-200 mb-6">Recent Matches</h2>
              <div className="space-y-6">
                {matches.map((match) => (
                  <div key={match.id} className="bg-gray-900/50 rounded-lg p-6">
                    <div className="flex justify-between items-center mb-4">
                      <p className="text-lg font-medium text-gray-200">
                        Winner: <span className={match.winner === 'X' ? 'text-blue-400' : 'text-green-400'}>
                          {match.winner}
                        </span>
                      </p>
                      <p className="text-sm text-gray-400">
                        {new Date(match.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <GameBoard initialMoves={match.moves} isReplay={true} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-center mt-8">
            <ResetStatsButton userId={session.user.id} />
          </div>
        </div>
      </div>
    </main>
  );
} 