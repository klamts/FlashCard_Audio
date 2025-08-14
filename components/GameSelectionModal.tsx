import React from 'react';
import { GameType } from '../types';

interface GameSelectionModalProps {
  onSelectGame: (gameType: GameType) => void;
  onClose: () => void;
}

const games: { id: GameType; title: string; description: string }[] = [
  { id: 'imageToText', title: 'Image -> Text', description: 'See an image and type or say the correct name.' },
  { id: 'audioToText', title: 'Audio -> Text', description: 'Hear a word and type or say it correctly.' },
  { id: 'scrambled', title: 'Unscramble Words', description: 'See an image, hear the audio, and unscramble the letters.' },
  { id: 'fillInBlanks', title: 'Fill in the Blanks', description: 'Complete the word by filling in the missing letters.' },
  { id: 'audioToImage', title: 'Match Audio to Image', description: 'Listen to the audio and choose the matching image.' },
  { id: 'imageToAudio', title: 'Match Image to Audio', description: 'See an image and choose the matching audio.' },
];

const GameSelectionModal: React.FC<GameSelectionModalProps> = ({ onSelectGame, onClose }) => {
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="game-select-title">
      <div className="bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-6">
          <h2 id="game-select-title" className="text-2xl font-bold text-white">Choose a Game</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {games.map((game) => (
            <button
              key={game.id}
              onClick={() => onSelectGame(game.id)}
              className="p-4 bg-gray-700 rounded-lg text-left hover:bg-purple-600 hover:scale-105 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <h3 className="font-bold text-lg text-white">{game.title}</h3>
              <p className="text-sm text-gray-300 mt-1">{game.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GameSelectionModal;
