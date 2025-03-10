'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';

interface GameBoardProps {
  currentUser: User;
}

export default function GameBoard({ currentUser }: GameBoardProps) {
  const [board, setBoard] = useState<(string | null)[]>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<'X' | 'O'>('X');
  const [winner, setWinner] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  const checkWinner = (currentBoard: (string | null)[]) => {
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
      if (
        currentBoard[a] &&
        currentBoard[a] === currentBoard[b] &&
        currentBoard[a] === currentBoard[c]
      ) {
        return currentBoard[a];
      }
    }

    if (currentBoard.every(cell => cell !== null)) {
      return 'draw';
    }

    return null;
  };

  const handleClick = async (index: number) => {
    if (board[index] || winner) {
      return;
    }

    const newBoard = [...board];
    newBoard[index] = currentPlayer;
    setBoard(newBoard);

    const gameWinner = checkWinner(newBoard);
    if (gameWinner) {
      setWinner(gameWinner);
      
      // Update stats only if player X (currentUser) wins
      if (gameWinner === 'X') {
        const { data: existingStats } = await supabase
          .from('game_stats')
          .select('*')
          .eq('user_id', currentUser.id)
          .single();

        if (existingStats) {
          await supabase
            .from('game_stats')
            .update({
              wins: existingStats.wins + 1,
              total_games: existingStats.total_games + 1,
            })
            .eq('user_id', currentUser.id);
        } else {
          await supabase
            .from('game_stats')
            .insert([
              {
                user_id: currentUser.id,
                wins: 1,
                total_games: 1,
              },
            ]);
        }
      } else {
        // If O wins or it's a draw, just increment total games
        const { data: existingStats } = await supabase
          .from('game_stats')
          .select('*')
          .eq('user_id', currentUser.id)
          .single();

        if (existingStats) {
          await supabase
            .from('game_stats')
            .update({
              total_games: existingStats.total_games + 1,
            })
            .eq('user_id', currentUser.id);
        } else {
          await supabase
            .from('game_stats')
            .insert([
              {
                user_id: currentUser.id,
                wins: 0,
                total_games: 1,
              },
            ]);
        }
      }
    }

    setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X');
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setWinner(null);
    setCurrentPlayer('X');
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {winner && (
        <div className="text-xl font-bold text-gray-200 mb-4">
          {winner === 'draw' ? "It's a draw!" : `Player ${winner} wins!`}
        </div>
      )}
      
      <div className="text-gray-200 mb-4">
        Current Player: {currentPlayer}
      </div>

      <div className="grid grid-cols-3 gap-2 w-full max-w-[400px]">
        {board.map((value, index) => (
          <button
            key={index}
            onClick={() => handleClick(index)}
            className={`aspect-square bg-gray-700/50 rounded-lg flex items-center justify-center text-2xl font-bold transition-colors hover:bg-gray-600/50 ${
              value === 'X' ? 'text-blue-400' : value === 'O' ? 'text-red-400' : ''
            }`}
            disabled={!!value || !!winner}
          >
            {value}
          </button>
        ))}
      </div>

      {(winner || board.every(cell => cell !== null)) && (
        <button
          onClick={resetGame}
          className="btn-primary mt-4"
        >
          New Game
        </button>
      )}
    </div>
  );
} 