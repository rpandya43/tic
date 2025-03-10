'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type Player = 'X' | 'O';
type Board = (Player | null)[];

export default function GameBoard() {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<Player>('X');
  const [winner, setWinner] = useState<Player | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const supabase = createClientComponentClient();

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
    if (board[index] || isGameOver) return;

    const newBoard = [...board];
    newBoard[index] = currentPlayer;
    setBoard(newBoard);

    const gameWinner = checkWinner(newBoard);
    if (gameWinner) {
      setWinner(gameWinner);
      setIsGameOver(true);
      if (gameWinner === 'X') {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: stats } = await supabase
            .from('game_stats')
            .select('wins')
            .eq('user_id', user.id)
            .single();

          const currentWins = stats?.wins || 0;
          await supabase
            .from('game_stats')
            .upsert({
              user_id: user.id,
              wins: currentWins + 1,
            });
        }
      }
    } else if (!newBoard.includes(null)) {
      setIsGameOver(true);
    } else {
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X');
    }
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setCurrentPlayer('X');
    setWinner(null);
    setIsGameOver(false);
  };

  return (
    <div className="flex flex-col items-center">
      <div className="grid grid-cols-3 gap-4 mb-4">
        {board.map((cell, index) => (
          <button
            key={index}
            onClick={() => handleClick(index)}
            className="w-20 h-20 border-2 border-gray-300 flex items-center justify-center text-4xl font-bold hover:bg-gray-100"
            disabled={!!cell || isGameOver}
          >
            {cell}
          </button>
        ))}
      </div>
      <div className="text-xl mb-4">
        {winner ? `Winner: ${winner}` : isGameOver ? 'Game Over!' : `Current Player: ${currentPlayer}`}
      </div>
      <button
        onClick={resetGame}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Reset Game
      </button>
    </div>
  );
} 