'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { User } from '@supabase/supabase-js';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

interface GameBoardProps {
  gameId?: string;
  currentUser: User;
  isSpectator?: boolean;
  gridSize?: number;
  onGameEnd?: (winner: string | null) => void;
}

interface LiveGame {
  id: string;
  player_x: string;
  player_o: string;
  current_board: (string | null)[];
  grid_size: number;
  last_move: string;
}

export default function GameBoard({ gameId, currentUser, isSpectator = false, gridSize = 3, onGameEnd }: GameBoardProps) {
  const [board, setBoard] = useState<(string | null)[]>(Array(gridSize * gridSize).fill(null));
  const [currentPlayer, setCurrentPlayer] = useState<'X' | 'O'>('X');
  const [winner, setWinner] = useState<string | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [playerRole, setPlayerRole] = useState<'X' | 'O' | null>(null);
  const supabase = createClientComponentClient();

  useEffect(() => {
    // Reset board when grid size changes
    setBoard(Array(gridSize * gridSize).fill(null));
    setWinner(null);
    setCurrentPlayer('X');
  }, [gridSize]);

  useEffect(() => {
    if (!gameId) return;

    const fetchGame = async () => {
      const { data: game } = await supabase
        .from('live_games')
        .select('*')
        .eq('id', gameId)
        .single();

      if (game) {
        setBoard(game.current_board || Array(gridSize * gridSize).fill(null));
        setGameStarted(true);
        if (game.player_x === currentUser.id) {
          setPlayerRole('X');
        } else if (game.player_o === currentUser.id) {
          setPlayerRole('O');
        }
      }
    };

    fetchGame();

    // Subscribe to game updates
    const channel = supabase.channel(`game_${gameId}`);
    channel
      .on(
        'postgres_changes' as const,
        {
          event: '*',
          schema: 'public',
          table: 'live_games',
          filter: `id=eq.${gameId}`
        },
        (payload: RealtimePostgresChangesPayload<LiveGame>) => {
          if (payload.new && 'current_board' in payload.new) {
            const game = payload.new as LiveGame;
            setBoard(game.current_board);
            checkWinner(game.current_board);
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [gameId, currentUser.id, gridSize]);

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

  const handleClick = async (index: number) => {
    // Don't allow moves if:
    // 1. Cell is already filled
    // 2. There's already a winner
    // 3. User is spectating
    // 4. In a game and it's not user's turn
    // 5. Not in a game and it's O's turn (computer/other player)
    if (
      board[index] || 
      winner || 
      isSpectator || 
      (gameId && playerRole !== currentPlayer) ||
      (!gameId && currentPlayer === 'O')
    ) {
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

    if (gameId) {
      // Update game state in database
      await supabase
        .from('live_games')
        .update({
          current_board: newBoard,
          last_move: new Date().toISOString()
        })
        .eq('id', gameId);
    }

    setCurrentPlayer(currentPlayer === 'X' ? 'O' : 'X');

    // If playing against computer (no gameId), make computer move
    if (!gameId && !gameWinner) {
      setTimeout(() => {
        const emptyCells = newBoard
          .map((cell, idx) => cell === null ? idx : null)
          .filter((idx): idx is number => idx !== null);

        if (emptyCells.length > 0) {
          const computerMove = emptyCells[Math.floor(Math.random() * emptyCells.length)];
          handleClick(computerMove);
        }
      }, 500);
    }
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
    gap: '0.5rem',
    width: '100%',
    maxWidth: '400px'
  };

  return (
    <div className="flex flex-col items-center gap-4">
      {winner && (
        <div className="text-xl font-bold text-gray-200 mb-4">
          {winner === 'draw' ? "It's a draw!" : `Player ${winner} wins!`}
        </div>
      )}
      
      {!isSpectator && (
        <div className="text-gray-200 mb-4">
          {gameId ? (
            playerRole ? 
              `You are Player ${playerRole}` : 
              'Spectating'
          ) : (
            `Current Player: ${currentPlayer}`
          )}
        </div>
      )}

      <div style={gridStyle}>
        {board.map((value, index) => (
          <button
            key={index}
            onClick={() => handleClick(index)}
            className={`aspect-square bg-gray-700/50 rounded-lg flex items-center justify-center text-2xl font-bold transition-colors hover:bg-gray-600/50 ${
              value === 'X' ? 'text-blue-400' : value === 'O' ? 'text-red-400' : ''
            }`}
            disabled={
              !!value || 
              !!winner || 
              isSpectator || 
              (gameId && playerRole !== currentPlayer) ||
              (!gameId && currentPlayer === 'O')
            }
          >
            {value}
          </button>
        ))}
      </div>
    </div>
  );
} 