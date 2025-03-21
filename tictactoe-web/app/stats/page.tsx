'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { redirect } from 'next/navigation';

declare const window: {
  confirm: (message: string) => boolean;
  location: {
    reload: () => void;
  };
};

export default function Stats() {
  const [session, setSession] = useState<any>(null);
  const [stats, setStats] = useState<{ wins: number; total_games: number } | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    const getSession = async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);

      if (!currentSession) {
        redirect('/login');
      }
    };

    getSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);

      if (!session) {
        redirect('/login');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) return;

    const fetchStats = async () => {
      const { data: statsData } = await supabase
        .from('game_stats')
        .select('*')
        .eq('user_id', session.user.id)
        .single();

      setStats(statsData || { wins: 0, total_games: 0 });
    };

    fetchStats();
  }, [session]);

  const handleResetStats = async () => {
    if (window.confirm('Are you sure you want to reset all your stats? This cannot be undone.')) {
      await supabase.rpc('reset_user_stats', { user_id: session.user.id });
      window.location.reload();
    }
  };

  if (!session) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 shadow-2xl">
          <div className="mb-8 flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-200">Your Stats</h1>
            <button
              onClick={handleResetStats}
              className="btn-danger"
            >
              Reset All Stats
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-gray-700/50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-200 mb-4">Total Wins</h2>
              <p className="text-4xl font-bold text-blue-400">{stats?.wins || 0}</p>
            </div>
            <div className="bg-gray-700/50 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-gray-200 mb-4">Total Games</h2>
              <p className="text-4xl font-bold text-purple-400">{stats?.total_games || 0}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 