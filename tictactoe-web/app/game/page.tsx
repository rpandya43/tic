'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { redirect } from 'next/navigation';
import GameBoard from '../components/GameBoard';
import GridSizeSelector from '../components/GridSizeSelector';

export default function Game() {
  const [gridSize, setGridSize] = useState(3);
  const [session, setSession] = useState<any>(null);
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

  const handleGameEnd = async (winner: string | null) => {
    if (!session?.user) return;

    // Update stats only if player X wins
    if (winner === 'X') {
      const { data: stats } = await supabase
        .from('game_stats')
        .select('wins')
        .eq('user_id', session.user.id)
        .single();

      const currentWins = stats?.wins || 0;
      await supabase
        .from('game_stats')
        .upsert({
          user_id: session.user.id,
          wins: currentWins + 1,
        });
    }
  };

  if (!session) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-8 shadow-2xl">
          <div className="mb-8 flex justify-between items-center">
            <h1 className="text-3xl font-bold text-gray-200">Tic Tac Toe</h1>
            <GridSizeSelector currentSize={gridSize} onSelect={setGridSize} />
          </div>
          <GameBoard 
            currentUser={session.user}
            gridSize={gridSize}
            onGameEnd={handleGameEnd}
          />
        </div>
      </div>
    </div>
  );
} 