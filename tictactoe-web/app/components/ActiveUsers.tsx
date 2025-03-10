'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

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
            status: 'online',
            last_seen: new Date().toISOString()
          });

        // Immediately fetch active users after setting up presence
        await fetchActiveUsers();
      } catch (error) {
        console.error('Error setting up presence:', error);
      }
    };

    // Subscribe to presence changes with better error handling
    const presenceChannel = supabase.channel('presence_updates');
    
    presenceChannel
      .on(
        'postgres_changes' as const,
        {
          event: '*',
          schema: 'public',
          table: 'presence'
        },
        async (payload: RealtimePostgresChangesPayload<{ [key: string]: any }>) => {
          if (!isSubscribed) return;
          console.log('Presence update received:', payload);
          await fetchActiveUsers();
        }
      )
      .subscribe((status) => {
        console.log('Presence subscription status:', status);
      });

    // Subscribe to challenges with proper typing
    const challengesChannel = supabase.channel('challenge_updates');
    
    challengesChannel
      .on(
        'postgres_changes' as const,
        {
          event: '*',
          schema: 'public',
          table: 'game_challenges'
        },
        async (payload: RealtimePostgresChangesPayload<Challenge>) => {
          if (!isSubscribed) return;
          console.log('Challenge update received:', payload);

          // If a challenge was accepted
          if (payload.new && 'status' in payload.new && payload.new.status === 'accepted') {
            const challenge = payload.new as Challenge;
            
            // Check if current user is involved in the challenge
            if (challenge.challenger_id === currentUser.id || challenge.challenged_id === currentUser.id) {
              try {
                // Create new game
                const { data: game, error: gameError } = await supabase
                  .from('live_games')
                  .insert({
                    player_x: challenge.challenger_id,
                    player_o: challenge.challenged_id,
                    current_board: Array(9).fill(null)
                  })
                  .select()
                  .single();

                if (gameError) throw gameError;

                if (game) {
                  // Update both players' presence
                  await supabase
                    .from('presence')
                    .update({
                      status: 'in_game',
                      current_game_id: game.id
                    })
                    .in('user_id', [challenge.challenger_id, challenge.challenged_id]);

                  router.push(`/game/${game.id}`);
                }
              } catch (error) {
                console.error('Error handling accepted challenge:', error);
              }
            }
          }

          // Always fetch challenges to update UI
          await fetchChallenges();
        }
      )
      .subscribe((status) => {
        console.log('Challenges subscription status:', status);
      });

    // Subscribe to live games with proper error handling
    const gamesChannel = supabase.channel('game_updates');
    
    gamesChannel
      .on(
        'postgres_changes' as const,
        {
          event: '*',
          schema: 'public',
          table: 'live_games'
        },
        async () => {
          if (!isSubscribed) return;
          await fetchActiveUsers();
        }
      )
      .subscribe((status) => {
        console.log('Games subscription status:', status);
      });

    // Initial setup
    setupPresence();
    fetchActiveUsers();
    fetchChallenges();

    // Update presence more frequently (every 30 seconds)
    const interval = setInterval(async () => {
      if (!isSubscribed) return;

      try {
        const { error } = await supabase
          .from('presence')
          .update({
            last_seen: new Date().toISOString()
          })
          .eq('user_id', currentUser.id);

        if (error) {
          // If presence record doesn't exist, recreate it
          await setupPresence();
        }
      } catch (error) {
        console.error('Error updating presence:', error);
      }
    }, 30000);

    // Cleanup function with better error handling
    const cleanup = async () => {
      try {
        if (isSubscribed) {
          await supabase
            .from('presence')
            .delete()
            .eq('user_id', currentUser.id);
        }
      } catch (error) {
        console.error('Error cleaning up presence:', error);
      } finally {
        presenceChannel.unsubscribe();
        challengesChannel.unsubscribe();
        gamesChannel.unsubscribe();
        clearInterval(interval);
      }
    };

    // Handle window events in a type-safe way for browser environments
    if (typeof window !== 'undefined') {
      (window as Window).addEventListener('beforeunload', cleanup);
    }

    return () => {
      isSubscribed = false;
      if (typeof window !== 'undefined') {
        (window as Window).removeEventListener('beforeunload', cleanup);
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