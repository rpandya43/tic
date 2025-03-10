'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';

interface ActiveUser {
  id: string;
  username: string;
  status: 'online' | 'in_game' | 'idle';
  current_game_id?: string;
}

interface Challenge {
  id: string;
  challenger_id: string;
  challenged_id: string;
  status: 'pending' | 'accepted' | 'declined' | 'cancelled';
}

export default function ActiveUsers({ currentUser }: { currentUser: User }) {
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const supabase = createClientComponentClient();

  useEffect(() => {
    // Set up initial presence
    const setupPresence = async () => {
      await supabase
        .from('presence')
        .upsert({
          user_id: currentUser.id,
          username: currentUser.email?.split('@')[0],
          status: 'online'
        });
    };

    // Subscribe to presence changes
    const presenceChannel = supabase.channel('presence');
    
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        fetchActiveUsers();
      })
      .subscribe();

    // Subscribe to challenges
    const challengesChannel = supabase.channel('challenges');
    
    challengesChannel
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table: 'game_challenges'
        },
        () => {
          fetchChallenges();
        }
      )
      .subscribe();

    setupPresence();
    fetchActiveUsers();
    fetchChallenges();

    // Update presence every minute
    const interval = setInterval(() => {
      supabase
        .from('presence')
        .upsert({
          user_id: currentUser.id,
          username: currentUser.email?.split('@')[0],
          status: 'online'
        });
    }, 60000);

    return () => {
      presenceChannel.unsubscribe();
      challengesChannel.unsubscribe();
      clearInterval(interval);
    };
  }, [currentUser]);

  const fetchActiveUsers = async () => {
    const { data } = await supabase
      .from('presence')
      .select('*')
      .gt('last_seen', new Date(Date.now() - 5 * 60 * 1000).toISOString());
    
    if (data) {
      setActiveUsers(data);
    }
  };

  const fetchChallenges = async () => {
    const { data } = await supabase
      .from('game_challenges')
      .select('*')
      .or(`challenger_id.eq.${currentUser.id},challenged_id.eq.${currentUser.id}`)
      .eq('status', 'pending');
    
    if (data) {
      setChallenges(data);
    }
  };

  const challengeUser = async (userId: string) => {
    await supabase
      .from('game_challenges')
      .insert({
        challenger_id: currentUser.id,
        challenged_id: userId,
        status: 'pending'
      });
  };

  const respondToChallenge = async (challengeId: string, accept: boolean) => {
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
            player_o: challenge.challenged_id
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
          window.location.href = `/game/${game.id}`;
        }
      }
    } else {
      await supabase
        .from('game_challenges')
        .update({ status: 'declined' })
        .eq('id', challengeId);
    }
  };

  const spectateGame = (gameId: string) => {
    window.location.href = `/game/${gameId}?spectate=true`;
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
            {user.id !== currentUser.id && (
              <div>
                {user.status === 'in_game' ? (
                  <button
                    onClick={() => spectateGame(user.current_game_id!)}
                    className="btn-secondary text-sm"
                  >
                    Spectate
                  </button>
                ) : (
                  <button
                    onClick={() => challengeUser(user.id)}
                    className="btn-primary text-sm"
                    disabled={challenges.some(c => 
                      (c.challenger_id === currentUser.id && c.challenged_id === user.id) ||
                      (c.challenger_id === user.id && c.challenged_id === currentUser.id)
                    )}
                  >
                    Challenge
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
                      {activeUsers.find(u => u.id === challenge.challenger_id)?.username} challenged you!
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => respondToChallenge(challenge.id, true)}
                        className="btn-primary text-sm"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => respondToChallenge(challenge.id, false)}
                        className="btn-danger text-sm"
                      >
                        Decline
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