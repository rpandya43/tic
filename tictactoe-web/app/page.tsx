import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import GameBoard from './components/GameBoard';

export default async function Home() {
  const supabase = createServerComponentClient({ cookies });
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Auth error:', error);
    return <div>Error loading session</div>;
  }

  if (!session) {
    redirect('/login');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="flex justify-between items-center w-full max-w-2xl mb-8">
        <h1 className="text-4xl font-bold">Tic Tac Toe</h1>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Sign Out
          </button>
        </form>
      </div>
      <GameBoard />
    </main>
  );
} 