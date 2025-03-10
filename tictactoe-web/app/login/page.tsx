import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import LoginForm from './LoginForm';

export default async function Login() {
  const supabase = createServerComponentClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    redirect('/');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 relative">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-transparent to-purple-600/20 z-0" />
      <div className="relative z-10 text-center space-y-8">
        <h1 className="text-5xl font-bold text-white tracking-tight">
          Welcome to Tic Tac Toe
        </h1>
        <p className="text-gray-400 text-lg max-w-md mx-auto">
          Sign in to play against friends or challenge yourself in this classic game
        </p>
        <LoginForm />
      </div>
    </div>
  );
} 