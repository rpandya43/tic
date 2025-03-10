'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';

interface GameBoardProps {
  currentUser: User;
  gridSize?: number;
  onGameEnd?: (winner: string | null) => void;
}

export default function GameBoard({ currentUser, gridSize = 3, onGameEnd }: GameBoardProps) {
  const [board, setBoard] = useState<(string | null)[]>(Array(gridSize * gridSize).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<'X' | 'O'>('X');
  const [winner, setWinner] = useState<string | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    // Reset board when grid size changes
    setBoard(Array(gridSize * gridSize).fill(null));
    setWinner(null);
    setCurrentPlayer('X');
  }, [gridSize]);

  const checkWinner = (currentBoard: (string | null)[]) => {
    // Check rows
    for (let i = 0; i < gridSize; i++) {
      const row = currentBoard.slice(i * gridSize, (i + 1) * gridSize);
      if (row.every(cell => cell === 'X')) return 'X';
      if (row.every(cell => cell === 'O')) return 'O';
    }

    // Check columns
    for (let i = 0; i < gridSize; i++) {
      const column = Array.from({ length: gridSize }, (_, j) => currentBoard[i + j * gridSize]);
      if (column.every(cell => cell === 'X')) return 'X';
      if (column.every(cell => cell === 'O')) return 'O';
    }

    // Check diagonals
    const diagonal1 = Array.from({ length: gridSize }, (_, i) => currentBoard[i * (gridSize + 1)]);
    const diagonal2 = Array.from({ length: gridSize }, (_, i) => currentBoard[(i + 1) * (gridSize - 1)]);

    if (diagonal1.every(cell => cell === 'X')) return 'X';
    if (diagonal1.every(cell => cell === 'O')) return 'O';
    if (diagonal2.every(cell => cell === 'X')) return 'X';
    if (diagonal2.every(cell => cell === 'O')) return 'O';

    // Check for draw
    if (currentBoard.every(cell => cell !== null)) return 'draw';

    return null;
  };

  const handleClick = (index: number) => {
    // Don't allow moves if cell is filled or there's a winner
    if (board[index] || winner) {
      return;
    }

    const newBoard = [...board];
    newBoard[index] = currentPlayer;
    setBoard(newBoard);

    const gameWinner = checkWinner(newBoard);
    if (gameWinner) {
      setWinner(gameWinner);
      if (onGameEnd) onGameEnd(gameWinner);
    }

    setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X');
  };

  const resetGame = () => {
    setBoard(Array(gridSize * gridSize).fill(null));
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

      <div className="grid gap-2" style={{
        gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
        width: '100%',
        maxWidth: '400px'
      }}>
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