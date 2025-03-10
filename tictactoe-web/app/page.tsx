import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import GameBoard from './components/GameBoard';
import Footer from './components/Footer';

export default async function Home() {
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-6 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 via-transparent to-purple-600/10 z-0" />
      <div className="relative z-10 w-full max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <h1 className="text-4xl font-bold text-white">Tic Tac Toe</h1>
          <div className="flex gap-4">
            <Link
              href="/stats"
              className="btn-primary"
            >
              View Stats
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
        <GameBoard />
      </div>
      <Footer />
    </main>
  );
} 