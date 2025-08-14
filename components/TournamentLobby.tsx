import React, { useState, useEffect } from 'react';
import { GameType, FlashcardItem, Tournament } from '../types';
import { createTournament, onTournamentsListUpdate } from '../services/firebaseService';
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
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [joinedTournament, setJoinedTournament] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const unsubscribe = onTournamentsListUpdate(setTournaments);
    return () => unsubscribe();
  }, []);

  const handleCreateTournament = async (gameType: GameType) => {
    if (!playerName.trim()) {
      setError('Please enter your name before creating a tournament.');
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
    
    // Use a subset of cards for the tournament to keep it snappy
    const tournamentQuestions = playableCards.slice(0, Math.min(10, playableCards.length));

    try {
      const tournamentId = await createTournament(playerName.trim(), gameType, tournamentQuestions);
      localStorage.setItem('playerName', playerName.trim());
      setJoinedTournament({ id: tournamentId, name: playerName.trim() });
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to create tournament.');
    } finally {
      setIsCreating(false);
      setIsGameModalOpen(false);
    }
  };

  const handleJoinTournament = async (tournamentId: string) => {
    // This will be handled inside the TournamentRoom component now
     if (!playerName.trim()) {
      setError('Please enter your name to join.');
      return;
    }
    localStorage.setItem('playerName', playerName.trim());
    setJoinedTournament({ id: tournamentId, name: playerName.trim() });
  }

  if (joinedTournament) {
    return (
      <TournamentRoom
        tournamentId={joinedTournament.id}
        playerName={joinedTournament.name}
        onExit={() => setJoinedTournament(null)}
      />
    );
  }

  return (
    <div className="max-w-4xl mx-auto bg-gray-800 p-6 rounded-lg">
       <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                Online Tournament Lobby
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
        <div className="bg-gray-700 p-6 rounded-lg">
          <h3 className="text-xl font-semibold mb-4 text-white">Create a New Tournament</h3>
          <div className="space-y-4">
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              placeholder="Enter Your Name"
              className="w-full px-4 py-2 bg-gray-800 border border-gray-600 rounded-lg text-white focus:ring-amber-500 focus:border-amber-500"
            />
            <button
              onClick={() => setIsGameModalOpen(true)}
              disabled={isCreating || !playerName.trim()}
              className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? 'Creating...' : 'Choose Game Mode & Create'}
            </button>
          </div>
        </div>
        
        {/* Join Tournament Section */}
        <div className="bg-gray-700 p-6 rounded-lg">
          <h3 className="text-xl font-semibold mb-4 text-white">Join an Existing Tournament</h3>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
            {tournaments.length === 0 ? (
              <p className="text-gray-400">No active tournaments. Why not create one?</p>
            ) : (
              tournaments.map((t) => (
                <div key={t.id} className="p-3 bg-gray-800 rounded-lg flex justify-between items-center">
                  <div>
                    <p className="font-bold">{t.gameType}</p>
                    <p className="text-sm text-gray-400">
                      Players: {Object.keys(t.players || {}).length}
                    </p>
                  </div>
                  <button
                    onClick={() => handleJoinTournament(t.id)}
                    disabled={!playerName.trim()}
                    className="px-4 py-1 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                  >
                    Join
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {isGameModalOpen && <GameSelectionModal onSelectGame={handleCreateTournament} onClose={() => setIsGameModalOpen(false)} />}
    </div>
  );
};

export default TournamentLobby;
