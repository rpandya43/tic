'use client';

import { useState } from 'react';
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
    <div className="w-full max-w-md mx-auto space-y-8">
      <div className="grid grid-cols-3 gap-4">
        {board.map((cell, index) => (
          <button
            key={index}
            onClick={() => handleClick(index)}
            disabled={!!cell || isGameOver}
            className={`w-24 h-24 text-4xl font-bold rounded-xl transition-all duration-200
              ${!cell && !isGameOver ? 'hover:bg-gray-700/50' : ''}
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
      <div className="text-center space-y-4">
        <div className="text-2xl font-semibold text-gray-200">
          {winner 
            ? `Winner: ${winner}` 
            : isGameOver 
              ? 'Game Over - Draw!' 
              : `Current Player: ${currentPlayer}`}
        </div>
        <button
          onClick={resetGame}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
            transition-colors duration-200 focus:outline-none focus:ring-2 
            focus:ring-blue-500 focus:ring-opacity-50"
        >
          Reset Game
        </button>
      </div>
    </div>
  );
} 