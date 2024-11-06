import React, { useEffect, useState } from 'react';
import { Player } from '../types/game';
import { useGameStore } from '../store/gameStore';
import clsx from 'clsx';
import { Keyboard } from './Keyboard';

const WORD_LENGTH = 5;
const MAX_ATTEMPTS = 6;

interface GameBoardProps {
  player: Player;
  isCurrentPlayer: boolean;
  showLetters?: boolean;
}

export function GameBoard({ player, isCurrentPlayer, showLetters = true }: GameBoardProps) {
  const [currentGuess, setCurrentGuess] = useState('');
  const { submitGuess, game } = useGameStore();

  // Initialize guesses and results with empty arrays if undefined
  const guesses = player?.guesses || [];
  const results = player?.results || [];

  const handleKeyPress = (key: string) => {
    if (!isCurrentPlayer || !game || game.status !== 'playing' || player.solved) return;

    if (key === 'Enter' && currentGuess.length === WORD_LENGTH) {
      submitGuess(currentGuess);
      setCurrentGuess('');
    } else if (key === 'Backspace') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (
      currentGuess.length < WORD_LENGTH && 
      /^[A-Za-z]$/.test(key) &&
      !player.solved
    ) {
      setCurrentGuess(prev => prev + key.toUpperCase());
    }
  };

  useEffect(() => {
    if (!isCurrentPlayer || !game || game.status !== 'playing') return;

    const handleKeyboardPress = (e: KeyboardEvent) => {
      handleKeyPress(e.key);
    };

    window.addEventListener('keydown', handleKeyboardPress);
    return () => window.removeEventListener('keydown', handleKeyboardPress);
  }, [currentGuess, game, isCurrentPlayer, player.solved, submitGuess]);

  const guessGrid = Array(MAX_ATTEMPTS).fill(null).map((_, rowIndex) => {
    const guess = guesses[rowIndex] || '';
    const result = results[rowIndex] || Array(WORD_LENGTH).fill(null);
    
    return Array(WORD_LENGTH).fill(null).map((_, colIndex) => {
      const letter = rowIndex === guesses.length && isCurrentPlayer 
        ? currentGuess[colIndex] || ''
        : guess[colIndex] || '';
      
      const status = result[colIndex];
      
      return {
        letter: showLetters ? letter : (letter ? '?' : ''),
        status,
      };
    });
  });

  // Calculate used letters for keyboard
  const usedLetters = guesses.reduce((acc, guess, guessIndex) => {
    guess.split('').forEach((letter, letterIndex) => {
      const status = results[guessIndex]?.[letterIndex];
      if (!acc[letter] || status === 'correct') {
        acc[letter] = status;
      }
    });
    return acc;
  }, {} as Record<string, string>);

  return (
    <div className="w-full max-w-sm mx-auto p-4">
      <div className="grid grid-rows-6 gap-2 mb-4">
        {guessGrid.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-5 gap-2">
            {row.map((cell, colIndex) => (
              <div
                key={colIndex}
                className={clsx(
                  'w-14 h-14 border-2 flex items-center justify-center text-2xl font-bold rounded transition-colors',
                  {
                    'bg-green-500 text-white border-green-600': cell.status === 'correct',
                    'bg-yellow-500 text-white border-yellow-600': cell.status === 'present',
                    'bg-gray-500 text-white border-gray-600': cell.status === 'absent',
                    'border-gray-300': !cell.status && cell.letter,
                    'border-gray-200': !cell.status && !cell.letter
                  }
                )}
              >
                {cell.letter}
              </div>
            ))}
          </div>
        ))}
      </div>

      {isCurrentPlayer && game?.status === 'playing' && !player.solved && (
        <>
          <div className="mt-4 text-center text-sm text-gray-600 mb-4">
            Type your guess and press Enter
          </div>
          <Keyboard 
            onKeyPress={handleKeyPress}
            usedLetters={usedLetters}
          />
        </>
      )}

      {player.solved && (
        <div className="mt-4 text-center text-lg font-semibold text-green-600">
          Word solved! 🎉
        </div>
      )}

      {!isCurrentPlayer && game?.status === 'waiting' && (
        <div className="mt-4 text-center text-lg text-gray-600">
          Waiting for host to start the game...
        </div>
      )}
    </div>
  );
}