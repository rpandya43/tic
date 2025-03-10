'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { redirect } from 'next/navigation';
import GameBoard from './components/GameBoard';
import ActiveUsers from './components/ActiveUsers';
import Footer from './components/Footer';

export default function Home() {
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

  if (!session) {
    return null;
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-6 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-purple-600/10 z-0" />
      <div className="relative z-10 w-full max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-bold text-white">Tic Tac Toe</h1>
          <div className="flex gap-4">
            <a
              href="/stats"
              className="btn-primary"
            >
              View Stats
            </a>
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

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3">
            <GameBoard currentUser={session.user} />
          </div>
          <div>
            <ActiveUsers currentUser={session.user} />
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
} 