'use client';

import { useEffect, useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';

type Player = 'X' | 'O';
type Board = (Player | null)[];
type Move = { position: number; player: Player };

interface GameState {
  id: string;
  player_x: string;
  player_o: string;
  current_board: string[];
  current_player: Player;
  winner: Player | null;
  spectator_count: number;
  spectators: string[];
}

interface PlayerInfo {
  user_id: string;
  username: string;
}

interface LiveGameProps {
  gameId: string;
  currentUser: User;
  game: GameState;
  players: PlayerInfo[];
  isSpectator: boolean;
}

export default function LiveGame({
  gameId,
  currentUser,
  game: initialGame,
  players,
  isSpectator
}: LiveGameProps) {
  const [game, setGame] = useState<GameState>(initialGame);
  const [board, setBoard] = useState<Board>(
    initialGame.current_board.map(cell => cell as Player | null)
  );
  const supabase = createClientComponentClient();

  useEffect(() => {
    // Join game channel
    const gameChannel = supabase.channel(`game:${gameId}`);

    // Handle game updates
    gameChannel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_games',
          filter: `id=eq.${gameId}`
        },
        (payload: { new: GameState }) => {
          setGame(payload.new);
          setBoard(payload.new.current_board.map(cell => cell as Player | null));
        }
      )
      .subscribe();

    // Update spectator count if spectating
    if (isSpectator) {
      const updateSpectators = async () => {
        await supabase
          .from('live_games')
          .update({
            spectator_count: game.spectator_count + 1,
            spectators: [...game.spectators, currentUser.id]
          })
          .eq('id', gameId);
      };

      updateSpectators();
    }

    return () => {
      // Remove spectator when leaving
      if (isSpectator) {
        supabase
          .from('live_games')
          .update({
            spectator_count: game.spectator_count - 1,
            spectators: game.spectators.filter(id => id !== currentUser.id)
          })
          .eq('id', gameId);
      }
      gameChannel.unsubscribe();
    };
  }, [gameId, isSpectator]);

  const checkWinner = (squares: Board): Player | null => {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];

    for (const [a, b, c] of lines) {
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }

    return null;
  };

  const handleClick = async (index: number) => {
    if (
      isSpectator ||
      board[index] ||
      game.winner ||
      (game.current_player === 'X' && currentUser.id !== game.player_x) ||
      (game.current_player === 'O' && currentUser.id !== game.player_o)
    ) {
      return;
    }

    const newBoard = [...board];
    newBoard[index] = game.current_player;
    const winner = checkWinner(newBoard);

    await supabase
      .from('live_games')
      .update({
        current_board: newBoard,
        current_player: game.current_player === 'X' ? 'O' : 'X',
        winner: winner,
        updated_at: new Date().toISOString()
      })
      .eq('id', gameId);

    if (winner || !newBoard.includes(null)) {
      // Game over, update presence
      await supabase
        .from('presence')
        .update({
          status: 'online',
          current_game_id: null
        })
        .in('user_id', [game.player_x, game.player_o]);
    }
  };

  const getStatus = () => {
    if (game.winner) {
      const winner = players.find(p => 
        p.user_id === (game.winner === 'X' ? game.player_x : game.player_o)
      );
      return `Winner: ${winner?.username || game.winner}`;
    }
    
    if (!board.includes(null)) {
      return "Game Over - Draw!";
    }

    const currentPlayer = players.find(p =>
      p.user_id === (game.current_player === 'X' ? game.player_x : game.player_o)
    );
    return `Current Player: ${currentPlayer?.username || game.current_player}`;
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-8">
      {game.spectator_count > 0 && (
        <div className="text-center text-gray-400">
          {game.spectator_count} {game.spectator_count === 1 ? 'person' : 'people'} watching
        </div>
      )}
      <div className="grid grid-cols-3 gap-4">
        {board.map((cell, index) => (
          <button
            key={index}
            onClick={() => handleClick(index)}
            disabled={
              isSpectator ||
              !!cell ||
              !!game.winner ||
              (game.current_player === 'X' && currentUser.id !== game.player_x) ||
              (game.current_player === 'O' && currentUser.id !== game.player_o)
            }
            className={`w-24 h-24 text-4xl font-bold rounded-xl transition-all duration-200
              ${!cell && !game.winner ? 'hover:bg-gray-700/50' : ''}
              ${cell ? 'bg-gray-800' : 'bg-gray-800/50'}
              ${cell === 'X' ? 'text-blue-400' : cell === 'O' ? 'text-green-400' : 'text-gray-700'}
              disabled:cursor-not-allowed backdrop-blur-sm
              border-2 border-gray-700/50 hover:border-gray-600
              focus:outline-none focus:ring-2 focus:ring-blue-500/50`}
          >
            {cell}
          </button>
        ))}
      </div>
      <div className="text-center">
        <div className="text-2xl font-semibold text-gray-200">
          {getStatus()}
        </div>
      </div>
    </div>
  );
} 