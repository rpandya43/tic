'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

interface ActiveUser {
  id: string;
  user_id: string;
  username: string;
  status: 'online' | 'in_game' | 'idle';
  current_game_id?: string;
  last_seen: string;
}

interface Challenge {
  id: string;
  challenger_id: string;
  challenged_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
}

interface RealtimePayload {
  new: Challenge;
  old: Challenge;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
}

export default function ActiveUsers({ currentUser }: { currentUser: User }) {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClientComponentClient();
  const router = useRouter();

  useEffect(() => {
    let isSubscribed = true;

    // Set up initial presence
    const setupPresence = async () => {
      if (!isSubscribed) return;

      try {
        // First, clean up any existing presence for this user
        await supabase
          .from('presence')
          .delete()
          .eq('user_id', currentUser.id);

        // Then create a new presence
        await supabase
          .from('presence')
          .insert({
            user_id: currentUser.id,
            username: currentUser.email?.split('@')[0],
            status: 'online'
          });
      } catch (error) {
        console.error('Error setting up presence:', error);
      }
    };

    // Subscribe to presence changes
    const presenceChannel = supabase.channel('presence-' + currentUser.id);
    
    presenceChannel
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'presence'
        },
        () => {
          if (isSubscribed) {
            fetchActiveUsers();
          }
        }
      )
      .subscribe();

    // Subscribe to challenges
    const challengesChannel = supabase.channel('challenges-' + currentUser.id);
    
    challengesChannel
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'game_challenges',
          filter: `challenger_id=eq.${currentUser.id} OR challenged_id=eq.${currentUser.id}`
        },
        async (payload: RealtimePayload) => {
          if (!isSubscribed) return;

          // If a challenge was accepted, check if we need to redirect
          if (payload.new && payload.new.status === 'accepted') {
            const challenge = payload.new;
            if (challenge.challenger_id === currentUser.id || challenge.challenged_id === currentUser.id) {
              const { data: game } = await supabase
                .from('live_games')
                .select('*')
                .eq('player_x', challenge.challenger_id)
                .eq('player_o', challenge.challenged_id)
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

              if (game) {
                router.push(`/game/${game.id}`);
                return;
              }
            }
          }

          fetchChallenges();
        }
      )
      .subscribe();

    setupPresence();
    fetchActiveUsers();
    fetchChallenges();

    // Update presence every minute
    const interval = setInterval(async () => {
      if (!isSubscribed) return;

      try {
        const { data } = await supabase
          .from('presence')
          .update({
            last_seen: new Date().toISOString()
          })
          .eq('user_id', currentUser.id)
          .select()
          .single();

        if (!data) {
          // If presence record doesn't exist, create it
          await setupPresence();
        }
      } catch (error) {
        console.error('Error updating presence:', error);
      }
    }, 60000);

    // Cleanup function
    const cleanup = async () => {
      if (!isSubscribed) return;

      try {
        await supabase
          .from('presence')
          .delete()
          .eq('user_id', currentUser.id);
        
        presenceChannel.unsubscribe();
        challengesChannel.unsubscribe();
        clearInterval(interval);
      } catch (error) {
        console.error('Error cleaning up:', error);
      }
    };

    // Handle cleanup on unmount and page unload
    if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
      globalThis.window.addEventListener('beforeunload', cleanup);
    }

    return () => {
      isSubscribed = false;
      if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
        globalThis.window.removeEventListener('beforeunload', cleanup);
      }
      cleanup();
    };
  }, [currentUser, router]);

  const fetchActiveUsers = async () => {
    try {
      const { data } = await supabase
        .from('presence')
        .select('*')
        .gt('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString());
      
      if (data) {
        // Remove duplicates by user_id, keeping only the most recent entry
        const uniqueUsers = data.reduce((acc, user) => {
          if (!acc[user.user_id] || new Date(user.last_seen) > new Date(acc[user.user_id].last_seen)) {
            acc[user.user_id] = user;
          }
          return acc;
        }, {} as Record<string, ActiveUser>);
        
        setActiveUsers(Object.values(uniqueUsers));
      }
    } catch (error) {
      console.error('Error fetching active users:', error);
    }
  };

  const fetchChallenges = async () => {
    try {
      const { data } = await supabase
        .from('game_challenges')
        .select('*')
        .or(`challenger_id.eq.${currentUser.id},challenged_id.eq.${currentUser.id}`)
        .eq('status', 'pending');
      
      if (data) {
        setChallenges(data);
      }
    } catch (error) {
      console.error('Error fetching challenges:', error);
    }
  };

  const challengeUser = async (userId: string) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('game_challenges')
        .insert({
          challenger_id: currentUser.id,
          challenged_id: userId,
          status: 'pending'
        });

      if (error) throw error;
      await fetchChallenges();
    } catch (error) {
      console.error('Error creating challenge:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const respondToChallenge = async (challengeId: string, accept: boolean) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      if (accept) {
        const { data: challenge } = await supabase
          .from('game_challenges')
          .update({ status: 'accepted' })
          .eq('id', challengeId)
          .select()
          .single();

        if (challenge) {
          // Create a new live game
          const { data: game } = await supabase
            .from('live_games')
            .insert({
              player_x: challenge.challenger_id,
              player_o: challenge.challenged_id,
              current_board: Array(9).fill(null)
            })
            .select()
            .single();

          if (game) {
            // Update both players' presence
            await supabase
              .from('presence')
              .update({
                status: 'in_game',
                current_game_id: game.id
              })
              .in('user_id', [challenge.challenger_id, challenge.challenged_id]);

            // Redirect to the game
            router.push(`/game/${game.id}`);
          }
        }
      } else {
        await supabase
          .from('game_challenges')
          .update({ status: 'declined' })
          .eq('id', challengeId);
      }
    } catch (error) {
      console.error('Error responding to challenge:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const spectateGame = (gameId: string) => {
    router.push(`/game/${gameId}?spectate=true`);
  };

  return (
    <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl p-6 shadow-2xl w-80">
      <h2 className="text-xl font-semibold text-gray-200 mb-4">Active Users</h2>
      <div className="space-y-4">
        {activeUsers.map((user) => (
          <div
            key={user.id}
            className="flex items-center justify-between bg-gray-700/50 rounded-lg p-3"
          >
            <div>
              <p className="text-gray-200">{user.username}</p>
              <p className="text-sm text-gray-400">
                {user.status === 'in_game' ? 'In Game' : user.status === 'idle' ? 'Idle' : 'Online'}
              </p>
            </div>
            {user.user_id !== currentUser.id && (
              <div>
                {user.status === 'in_game' ? (
                  <button
                    onClick={() => spectateGame(user.current_game_id!)}
                    className="btn-secondary text-sm"
                    disabled={isLoading}
                  >
                    Spectate
                  </button>
                ) : (
                  <button
                    onClick={() => challengeUser(user.user_id)}
                    className="btn-primary text-sm"
                    disabled={
                      isLoading ||
                      challenges.some(c => 
                        (c.challenger_id === currentUser.id && c.challenged_id === user.user_id) ||
                        (c.challenger_id === user.user_id && c.challenged_id === currentUser.id)
                      )
                    }
                  >
                    {isLoading ? 'Loading...' : 'Challenge'}
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {challenges.length > 0 && (
        <div className="mt-8">
          <h3 className="text-lg font-semibold text-gray-200 mb-4">Challenges</h3>
          <div className="space-y-4">
            {challenges.map((challenge) => (
              <div
                key={challenge.id}
                className="bg-gray-700/50 rounded-lg p-3"
              >
                {challenge.challenger_id === currentUser.id ? (
                  <p className="text-gray-200 mb-2">
                    Waiting for response...
                  </p>
                ) : (
                  <div>
                    <p className="text-gray-200 mb-2">
                      {activeUsers.find(u => u.user_id === challenge.challenger_id)?.username} challenged you!
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => respondToChallenge(challenge.id, true)}
                        className="btn-primary text-sm"
                        disabled={isLoading}
                      >
                        {isLoading ? 'Loading...' : 'Accept'}
                      </button>
                      <button
                        onClick={() => respondToChallenge(challenge.id, false)}
                        className="btn-danger text-sm"
                        disabled={isLoading}
                      >
                        {isLoading ? 'Loading...' : 'Decline'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 