import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { onTournamentUpdate, joinTournament, startTournament, updatePlayerState, checkAndFinishTournament } from '../services/firebaseService';
import { Tournament, TournamentPlayer, GameType, TournamentQuestion } from '../types';
import { shuffleArray, scrambleText, createBlanks, getRandomItems, compareText } from '../utils/gameUtils';
import Spinner from './Spinner';

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSpeechRecognitionSupported = !!SpeechRecognitionAPI;

const gameTitles: Record<GameType, string> = {
  imageToText: 'Image to Text',
  audioToText: 'Audio to Text',
  scrambled: 'Unscramble Words',
  fillInBlanks: 'Fill in the Blanks',
  audioToImage: 'Match Audio to Image',
  imageToAudio: 'Match Image to Audio',
};

const Medal = ({ rank }: { rank: number }) => {
  const styles: Record<number, { color: string, emoji: string }> = {
    1: { color: 'text-yellow-400', emoji: '🥇' },
    2: { color: 'text-gray-300', emoji: '🥈' },
    3: { color: 'text-yellow-600', emoji: '🥉' },
  };
  if (!styles[rank]) return null;
  return <span className={`text-2xl ${styles[rank].color}`} role="img" aria-label={`Rank ${rank}`}>{styles[rank].emoji}</span>;
};


interface TournamentRoomProps {
  tournamentId: string;
  playerName: string;
  onExit: () => void;
}

const TournamentRoom: React.FC<TournamentRoomProps> = ({ tournamentId, playerName, onExit }) => {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [mcqOptions, setMcqOptions] = useState<TournamentQuestion[]>([]);
  const [selectedMcqId, setSelectedMcqId] = useState<string | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState(0);

  const player = useMemo(() => tournament?.players?.[playerName], [tournament, playerName]);
  const currentQuestionIndex = player?.currentQuestionIndex ?? 0;
  const currentQuestion = tournament?.questions?.[currentQuestionIndex];
  
  // Real-time listener for tournament updates
  useEffect(() => {
    const unsubscribe = onTournamentUpdate(tournamentId, (data) => {
      if (data) {
        // If player is new, automatically join them
        if (!data.players?.[playerName]) {
          joinTournament(tournamentId, playerName).catch(setError);
        }
        setTournament(data);
        if (data.status === 'playing' && questionStartTime === 0) {
          setQuestionStartTime(Date.now());
        }
      } else {
        setError("Tournament not found or has been deleted.");
      }
    });
    return () => unsubscribe();
  }, [tournamentId, playerName, questionStartTime]);

  // Setup MCQ options when question changes
  useEffect(() => {
    if (tournament && currentQuestion && (tournament.gameType === 'audioToImage' || tournament.gameType === 'imageToAudio')) {
        const randomOptions = getRandomItems(tournament.questions, currentQuestion.id, 3);
        setMcqOptions(shuffleArray([...randomOptions, currentQuestion]));
    }
  }, [currentQuestion, tournament]);


  const handleCheckAnswer = async () => {
    if (!tournament || !player || !currentQuestion) return;

    const timeTaken = Date.now() - questionStartTime;
    const isMcq = tournament.gameType === 'audioToImage' || tournament.gameType === 'imageToAudio';
    const answer = isMcq ? selectedMcqId : userInput.trim();
    const isCorrect = isMcq
        ? answer === currentQuestion.id
        : answer.toLowerCase() === currentQuestion.text.toLowerCase();

    let scoreIncrement = 0;
    if (isCorrect) {
      // Score based on speed: max 1000 points, decreasing with time
      scoreIncrement = Math.max(0, 1000 - Math.floor(timeTaken / 20));
    }
    
    const nextIndex = currentQuestionIndex + 1;
    const isFinished = nextIndex >= tournament.questions.length;

    await updatePlayerState(tournamentId, playerName, {
        score: player.score + scoreIncrement,
        currentQuestionIndex: nextIndex,
        isFinished: isFinished,
    });
    
    setUserInput('');
    setSelectedMcqId(null);
    setQuestionStartTime(Date.now());

    if(isFinished) {
        await checkAndFinishTournament(tournamentId);
    }
  };

  const sortedPlayers = useMemo(() => {
    if (!tournament?.players) return [];
    return Object.values(tournament.players).sort((a, b) => b.score - a.score);
  }, [tournament?.players]);

  if (error) return <div className="text-center p-8 text-red-400">{error} <button onClick={onExit} className="underline">Go back</button></div>;
  if (!tournament) return <div className="text-center p-8"><Spinner /> Loading tournament...</div>;


  // WAITING ROOM
  if (tournament.status === 'waiting') {
    return (
      <div className="max-w-2xl mx-auto bg-gray-800 p-6 rounded-lg text-center">
        <h2 className="text-2xl font-bold mb-2">Waiting for Players...</h2>
        <p className="mb-4 text-gray-400">Game: <span className="font-semibold text-white">{gameTitles[tournament.gameType]}</span></p>
        <div className="bg-gray-900 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-bold mb-2 text-purple-400">Players Joined</h3>
          <ul className="space-y-2">
            {sortedPlayers.map(p => <li key={p.id} className="text-white font-semibold text-xl">{p.name}</li>)}
          </ul>
        </div>
        {tournament.creatorId === playerName ? (
          <button onClick={() => startTournament(tournamentId)} className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold">
            Start Game for Everyone
          </button>
        ) : (
          <p className="text-gray-400">The host (<span className="text-white">{tournament.creatorId}</span>) will start the game soon.</p>
        )}
        <button onClick={onExit} className="mt-4 text-sm text-gray-500 hover:underline">Leave Tournament</button>
      </div>
    );
  }

  // FINISHED SCREEN
  if (tournament.status === 'finished') {
    return (
        <div className="max-w-2xl mx-auto bg-gray-800 p-6 rounded-lg text-center">
            <h2 className="text-4xl font-bold text-yellow-400 mb-4">Tournament Finished!</h2>
            <div className="space-y-3">
                {sortedPlayers.map((p, index) => (
                    <div key={p.id} className="p-4 bg-gray-700 rounded-lg flex items-center justify-between text-lg">
                        <div className="flex items-center gap-4">
                            <Medal rank={index + 1} />
                            <span className="font-bold">{p.name}</span>
                        </div>
                        <span className="font-semibold text-purple-400">{p.score} pts</span>
                    </div>
                ))}
            </div>
            <button onClick={onExit} className="mt-8 px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold">
                Back to Lobby
            </button>
        </div>
    );
  }

  // GAMEPLAY SCREEN
  if (!currentQuestion || !player || player.isFinished) {
     return (
        <div className="text-center p-8 bg-gray-800 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">You've finished!</h2>
          <p className="text-gray-400">Waiting for other players to complete the tournament...</p>
          <Spinner />
          <div className="mt-6 w-full max-w-md mx-auto">
            <h3 className="text-xl font-bold mb-2 text-purple-400">Live Leaderboard</h3>
            <ul className="space-y-2 text-left">
              {sortedPlayers.map(p => (
                <li key={p.id} className="p-2 bg-gray-700 rounded-lg flex justify-between">
                  <span className="font-semibold">{p.name} {p.isFinished ? '🏁' : ''}</span>
                  <span className="text-gray-300">{p.score} pts</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      );
  }

  const renderGameContent = () => {
    switch (tournament.gameType) {
        case 'imageToText':
        case 'scrambled':
        case 'fillInBlanks':
            return <img src={currentQuestion.imageUrl!} alt="Guess the word" className="w-full max-w-sm mx-auto h-64 object-contain rounded-lg mb-4" />;
        case 'audioToText':
            return <audio key={currentQuestion.id} controls autoPlay src={currentQuestion.audioUrl} className="w-full h-12 mb-4" />;
        case 'audioToImage':
            return <>
                <audio key={currentQuestion.id} controls autoPlay src={currentQuestion.audioUrl} className="w-full h-12 mb-4" />
                <div className="grid grid-cols-2 gap-4">
                    {mcqOptions.map(option => <img key={option.id} src={option.imageUrl!} alt="Option" onClick={() => setSelectedMcqId(option.id)} className={`w-full h-40 object-cover rounded-lg cursor-pointer transition-all ${selectedMcqId === option.id ? 'scale-105 ring-4 ring-blue-500' : 'opacity-80 hover:opacity-100'}`} />)}
                </div>
            </>;
        case 'imageToAudio':
            return <>
                <img src={currentQuestion.imageUrl!} alt="Match the audio" className="w-full max-w-sm mx-auto h-64 object-contain rounded-lg mb-4" />
                <div className="grid grid-cols-2 gap-4">
                    {mcqOptions.map(option => <button key={option.id} onClick={() => setSelectedMcqId(option.id)} className={`p-4 rounded-lg flex items-center justify-center gap-2 transition-all ${selectedMcqId === option.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}`}><audio src={option.audioUrl} controls className="h-10 w-full"></audio></button>)}
                </div>
            </>;
        default: return null;
    }
  };

  const isTextInputGame = ['imageToText', 'audioToText', 'scrambled', 'fillInBlanks'].includes(tournament.gameType);

  return (
    <div className="flex gap-6">
        <div className="flex-grow bg-gray-800 p-6 rounded-lg">
             <header className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">{gameTitles[tournament.gameType]}</h2>
                <div className="text-lg font-semibold">Question {currentQuestionIndex + 1} of {tournament.questions.length}</div>
            </header>
            
            <div className="mb-4 text-center">
                {tournament.gameType === 'scrambled' && <p className="text-2xl font-bold tracking-widest my-4 p-2 bg-gray-700 rounded">{scrambleText(currentQuestion.text)}</p>}
                {tournament.gameType === 'fillInBlanks' && <p className="text-2xl font-bold tracking-widest my-4">{createBlanks(currentQuestion.text)}</p>}
            </div>

            <div>{renderGameContent()}</div>

            {isTextInputGame ? (
                <div className="mt-4">
                    <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCheckAnswer()} placeholder="Type your answer..." className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-purple-500 focus:border-purple-500" />
                </div>
            ) : null}

            <button onClick={handleCheckAnswer} disabled={isTextInputGame ? !userInput : !selectedMcqId} className="mt-4 w-full px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold disabled:opacity-50">
              Submit Answer
            </button>
        </div>

        <aside className="w-64 flex-shrink-0 bg-gray-800 p-4 rounded-lg">
            <h3 className="text-xl font-bold mb-4 text-purple-400">Leaderboard</h3>
            <ul className="space-y-2">
              {sortedPlayers.map(p => (
                <li key={p.id} className={`p-2 rounded-lg flex justify-between ${p.id === playerName ? 'bg-purple-900' : 'bg-gray-700'}`}>
                  <span className="font-semibold truncate">{p.name} {p.isFinished ? '🏁' : ''}</span>
                  <span className="text-gray-300 flex-shrink-0 pl-2">{p.score} pts</span>
                </li>
              ))}
            </ul>
        </aside>
    </div>
  );
};

export default TournamentRoom;