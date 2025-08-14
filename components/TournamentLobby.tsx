import React, { useState } from 'react';
import { GameType, FlashcardItem } from '../types';
import { shuffleArray } from '../utils/gameUtils';
import GameSelectionModal from './GameSelectionModal';
import TournamentRoom from './TournamentRoom';

interface TournamentLobbyProps {
  flashcards: FlashcardItem[];
  onExit: () => void;
}

const TournamentLobby: React.FC<TournamentLobbyProps> = ({ flashcards, onExit }) => {
  const [playerName, setPlayerName] = useState(localStorage.getItem('playerName') || '');
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  
  const [activeTournament, setActiveTournament] = useState<{
    roomCode: string;
    isHost: boolean;
    playerName: string;
    initialGameType?: GameType;
  } | null>(null);


  const handleCreateRoom = (gameType: GameType) => {
    if (!playerName.trim()) {
      setError('Please enter your name before creating a room.');
      return;
    }
    setError(null);
    setIsCreating(true);

    const playableCards = shuffleArray(flashcards.filter(c => c.imageUrl && c.audioUrl));
    if (playableCards.length < 5) {
        setError("You need at least 5 cards with images to create a tournament.");
        setIsCreating(false);
        return;
    }
    
    localStorage.setItem('playerName', playerName.trim());
    
    setActiveTournament({
        roomCode: '', // This will be set by the TournamentRoom as the host
        isHost: true,
        playerName: playerName.trim(),
        initialGameType: gameType,
    });
    
    setIsCreating(false);
    setIsGameModalOpen(false);
  };

  const handleJoinRoom = () => {
     if (!playerName.trim()) {
      setError('Please enter your name to join.');
      return;
    }
    if (!roomCode.trim()) {
      setError('Please enter a room code.');
      return;
    }
    localStorage.setItem('playerName', playerName.trim());
    setActiveTournament({
        roomCode: roomCode.trim(),
        isHost: false,
        playerName: playerName.trim(),
    });
  }

  if (activeTournament) {
    return (
      <TournamentRoom
        isHost={activeTournament.isHost}
        playerName={activeTournament.playerName}
        roomCode={activeTournament.roomCode}
        initialGameType={activeTournament.initialGameType}
        flashcards={flashcards}
        onExit={() => setActiveTournament(null)}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-gray-800 p-6 rounded-lg">
       <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                LAN Tournament Lobby
            </h2>
            <button onClick={onExit} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold">
                Back to Deck
            </button>
        </div>
        
        {error && (
            <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-4" role="alert">
                <span className="block sm:inline">{error}</span>
                <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3" aria-label="Close">
                    <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
                </button>
            </div>
        )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* Create Tournament Section */}
        <div className="bg-gray-700 p-6 rounded-lg flex flex-col">
          <h3 className="text-xl font-semibold mb-4 text-white">Create a New Room</h3>
          <div className="space-y-4 flex-grow flex flex-col">
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter Your Name"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-amber-500 focus:border-amber-500"
            />
             <div className="flex-grow"></div>
            <button
              onClick={() => setIsGameModalOpen(true)}
              disabled={isCreating || !playerName.trim()}
              className="w-full mt-auto px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? 'Creating...' : 'Create Room & Choose Game'}
            </button>
          </div>
        </div>
        
        {/* Join Tournament Section */}
        <div className="bg-gray-700 p-6 rounded-lg flex flex-col">
          <h3 className="text-xl font-semibold mb-4 text-white">Join an Existing Room</h3>
          <div className="space-y-4 flex-grow flex flex-col">
             <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter Your Name"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-amber-500 focus:border-amber-500"
            />
            <input
              type="text"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value)}
              placeholder="Enter Room Code"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-amber-500 focus:border-amber-500"
            />
             <div className="flex-grow"></div>
             <button
                onClick={handleJoinRoom}
                disabled={!playerName.trim() || !roomCode.trim()}
                className="w-full mt-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold disabled:opacity-50"
              >
                Join
             </button>
          </div>
        </div>
      </div>
      {isGameModalOpen && <GameSelectionModal onSelectGame={handleCreateRoom} onClose={() => setIsGameModalOpen(false)} />}
    </div>
  );
};

export default TournamentLobby;