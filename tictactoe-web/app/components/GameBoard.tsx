'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

type Player = 'X' | 'O';
type Board = (Player | null)[];
type Move = { position: number; player: Player };

interface GameBoardProps {
  initialMoves?: Move[];
  isReplay?: boolean;
}

export default function GameBoard({ initialMoves, isReplay }: GameBoardProps) {
  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<Player>('X');
  const [winner, setWinner] = useState<Player | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [moves, setMoves] = useState<Move[]>([]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(-1);
  const supabase = createClientComponentClient();

  useEffect(() => {
    if (initialMoves && isReplay) {
      setMoves(initialMoves);
      if (currentMoveIndex < initialMoves.length - 1) {
        const timer = setTimeout(() => {
          setCurrentMoveIndex(prev => prev + 1);
        }, 1000);
        return () => clearTimeout(timer);
      }
    }
  }, [initialMoves, currentMoveIndex, isReplay]);

  useEffect(() => {
    if (isReplay && currentMoveIndex >= 0) {
      const newBoard = Array(9).fill(null);
      for (let i = 0; i <= currentMoveIndex; i++) {
        newBoard[moves[i].position] = moves[i].player;
      }
      setBoard(newBoard);
      setCurrentPlayer(currentMoveIndex % 2 === 0 ? 'O' : 'X');

      // Check for winner after applying moves
      const gameWinner = checkWinner(newBoard);
      if (gameWinner) {
        setWinner(gameWinner);
        setIsGameOver(true);
      } else if (!newBoard.includes(null)) {
        setIsGameOver(true);
      }
    }
  }, [currentMoveIndex, moves, isReplay]);

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

  const getEmptyCells = (squares: Board): number[] => {
    return squares.reduce<number[]>((acc, cell, index) => {
      if (!cell) acc.push(index);
      return acc;
    }, []);
  };

  const makeAutoMove = () => {
    const emptyCells = getEmptyCells(board);
    if (emptyCells.length > 0) {
      const randomIndex = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      handleClick(randomIndex);
    }
  };

  useEffect(() => {
    if (isAutoPlay && currentPlayer === 'O' && !isGameOver && !isReplay) {
      const timer = setTimeout(() => {
        makeAutoMove();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [currentPlayer, isAutoPlay, isGameOver]);

  const handleClick = async (index: number) => {
    if (board[index] || isGameOver || isReplay) return;

    const newBoard = [...board];
    newBoard[index] = currentPlayer;
    const newMoves = [...moves, { position: index, player: currentPlayer }];
    setBoard(newBoard);
    setMoves(newMoves);

    const gameWinner = checkWinner(newBoard);
    if (gameWinner) {
      setWinner(gameWinner);
      setIsGameOver(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Store match history regardless of winner
        await supabase
          .from('match_history')
          .insert({
            user_id: user.id,
            winner: gameWinner,
            moves: newMoves
          });

        // Update wins only if X wins
        if (gameWinner === 'X') {
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
      // Store draws in match history
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('match_history')
          .insert({
            user_id: user.id,
            winner: currentPlayer, // Store the last player as winner in case of draw
            moves: newMoves
          });
      }
    } else {
      setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X');
    }
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setCurrentPlayer('X');
    setWinner(null);
    setIsGameOver(false);
    setMoves([]);
    setCurrentMoveIndex(-1);
  };

  return (
    <div className="w-full max-w-md mx-auto space-y-8">
      {!isReplay && (
        <div className="flex justify-between items-center">
          <div className="text-xl font-semibold text-gray-200">
            Mode: {isAutoPlay ? 'vs Computer' : 'vs Player'}
          </div>
          <button
            onClick={() => setIsAutoPlay(!isAutoPlay)}
            className="btn-secondary"
          >
            {isAutoPlay ? 'Switch to 2 Players' : 'Switch to vs Computer'}
          </button>
        </div>
      )}
      <div className="grid grid-cols-3 gap-4">
        {board.map((cell, index) => (
          <button
            key={index}
            onClick={() => handleClick(index)}
            disabled={!!cell || isGameOver || (isAutoPlay && currentPlayer === 'O') || isReplay}
            className={`w-24 h-24 text-4xl font-bold rounded-xl transition-all duration-200
              ${!cell && !isGameOver && !isReplay ? 'hover:bg-gray-700/50' : ''}
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
        {!isReplay && (
          <button
            onClick={resetGame}
            className="btn-primary"
          >
            Reset Game
          </button>
        )}
      </div>
    </div>
  );
} 