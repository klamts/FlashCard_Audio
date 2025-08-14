import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Tournament, TournamentPlayer, GameType, FlashcardItem } from '../types';
import { shuffleArray, scrambleText, createBlanks, getRandomItems } from '../utils/gameUtils';
import Spinner from './Spinner';

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
  isHost: boolean;
  playerName: string;
  roomCode: string; // The ID to connect to for clients
  initialGameType?: GameType;
  flashcards: FlashcardItem[];
  onExit: () => void;
}

const TournamentRoom: React.FC<TournamentRoomProps> = ({
  isHost,
  playerName,
  roomCode,
  initialGameType,
  flashcards,
  onExit,
}) => {
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userInput, setUserInput] = useState('');
  const [mcqOptions, setMcqOptions] = useState<any[]>([]);
  const [selectedMcqId, setSelectedMcqId] = useState<string | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState(0);
  const [copyStatus, setCopyStatus] = useState('Copy Code');

  const peerRef = useRef<any>(null);
  const hostConnectionRef = useRef<any>(null); // For clients
  const clientConnectionsRef = useRef<any>({}); // For host

  const broadcastTournamentState = useCallback((state: Tournament) => {
    Object.values(clientConnectionsRef.current).forEach((conn: any) => {
      conn.send({ type: 'STATE_UPDATE', payload: state });
    });
  }, []);
  
  // This effect ensures the host reliably broadcasts the latest state to all clients.
  useEffect(() => {
      if (isHost && tournament) {
          broadcastTournamentState(tournament);
      }
  }, [isHost, tournament, broadcastTournamentState]);


  // Host: Initialize tournament state
  useEffect(() => {
    if (!isHost) return;

    const playableCards = shuffleArray(flashcards.filter(c => c.imageUrl && c.audioUrl));
    const tournamentQuestions = playableCards.slice(0, Math.min(10, playableCards.length));
    
    const hostPlayer: TournamentPlayer = {
        id: playerName,
        name: playerName,
        score: 0,
        currentQuestionIndex: 0,
        isFinished: false,
    };

    setTournament({
      id: '', // Will be set on peer open
      gameType: initialGameType!,
      status: 'waiting',
      questions: tournamentQuestions,
      players: { [playerName]: hostPlayer },
      creatorId: playerName,
    });
  }, [isHost, initialGameType, flashcards, playerName]);

  // P2P Setup
  useEffect(() => {
    const peer = new window.Peer();
    peerRef.current = peer;

    peer.on('open', (id) => {
      if (isHost) {
        setTournament(prev => prev ? { ...prev, id } : null);
      } else {
        // Client connects to host
        const conn = peer.connect(roomCode);
        if (!conn) {
            setError(`Could not connect to room with code: ${roomCode}. Please check the code and try again.`);
            return;
        }
        hostConnectionRef.current = conn;
        conn.on('open', () => {
          conn.send({ type: 'JOIN_REQUEST', payload: { name: playerName } });
        });
        conn.on('data', (data: any) => {
          if (data.type === 'STATE_UPDATE') {
            setTournament(data.payload);
             if (data.payload.status === 'playing' && questionStartTime === 0) {
               setQuestionStartTime(Date.now());
             }
          }
        });
         conn.on('error', (err) => setError(`Connection error: ${err.type}. Message: ${err.message}`));
      }
    });

    if (isHost) {
      peer.on('connection', (conn) => {
        clientConnectionsRef.current[conn.peer] = conn;
        conn.on('data', (data: any) => {
          if (data.type === 'JOIN_REQUEST') {
            setTournament(prev => {
              if (!prev) return null;
              const newPlayer: TournamentPlayer = {
                id: conn.peer,
                name: data.payload.name,
                score: 0,
                currentQuestionIndex: 0,
                isFinished: false,
              };
              const updatedState = { ...prev, players: { ...prev.players, [data.payload.name]: newPlayer }};
              // No need to broadcast here, the useEffect on `tournament` state will handle it
              return updatedState;
            });
          } else if (data.type === 'SUBMIT_ANSWER') {
             handleAnswerSubmitted(data.payload.playerId, data.payload.answer, data.payload.timeTaken);
          }
        });
        conn.on('close', () => {
            delete clientConnectionsRef.current[conn.peer];
            setTournament(prev => {
                if (!prev) return null;
                const newPlayers = {...prev.players};
                const playerToRemove = Object.values(newPlayers).find(p => p.id === conn.peer);
                if (playerToRemove) {
                    delete newPlayers[playerToRemove.name];
                }
                const updatedState = {...prev, players: newPlayers };
                return updatedState;
            });
        });
      });
    }

    peer.on('error', (err) => setError(`PeerJS error: ${err.message}. Ensure you are on the same local network.`));

    return () => {
      peer.destroy();
    };
  }, [isHost, playerName, roomCode]);
  
  // MCQ options setup
  useEffect(() => {
    if (tournament && tournament.status === 'playing') {
      const player = tournament.players[playerName];
      const currentQuestion = player ? tournament.questions[player.currentQuestionIndex] : null;
      if (currentQuestion && (tournament.gameType === 'audioToImage' || tournament.gameType === 'imageToAudio')) {
        const randomOptions = getRandomItems(tournament.questions, currentQuestion.id, 3);
        setMcqOptions(shuffleArray([...randomOptions, currentQuestion]));
      }
    }
  }, [tournament?.status, tournament?.players, tournament?.questions, tournament?.gameType, playerName]);


  const handleAnswerSubmitted = (pName: string, answer: string, timeTaken: number) => {
    setTournament(prev => {
      if (!prev) return null;

      const playerState = prev.players[pName];
      const question = prev.questions[playerState.currentQuestionIndex];
      if (!playerState || !question) return prev;

      const isMcq = prev.gameType === 'audioToImage' || prev.gameType === 'imageToAudio';
      const isCorrect = isMcq ? answer === question.id : answer.toLowerCase() === question.text.toLowerCase();
      
      let scoreIncrement = 0;
      if (isCorrect) {
        scoreIncrement = Math.max(0, 1000 - Math.floor(timeTaken / 20));
      }

      const nextIndex = playerState.currentQuestionIndex + 1;
      const isFinished = nextIndex >= prev.questions.length;

      const updatedPlayer: TournamentPlayer = {
        ...playerState,
        score: playerState.score + scoreIncrement,
        currentQuestionIndex: nextIndex,
        isFinished: isFinished,
      };

      const updatedPlayers = { ...prev.players, [pName]: updatedPlayer };
      
      const allFinished = Object.values(updatedPlayers).every(p => p.isFinished);
      
      const updatedState = { 
          ...prev, 
          players: updatedPlayers,
          status: allFinished ? 'finished' as const : prev.status
      };
      
      return updatedState;
    });
  };

  const submitAnswer = () => {
    const timeTaken = Date.now() - questionStartTime;
    const isMcq = tournament!.gameType === 'audioToImage' || tournament!.gameType === 'imageToAudio';
    const answer = isMcq ? selectedMcqId : userInput.trim();

    if (!answer) return;

    if (isHost) {
      handleAnswerSubmitted(playerName, answer, timeTaken);
    } else {
      hostConnectionRef.current.send({ type: 'SUBMIT_ANSWER', payload: { playerId: playerName, answer, timeTaken } });
    }
    setUserInput('');
    setSelectedMcqId(null);
    setQuestionStartTime(Date.now());
  };
  
  const handleCopyCode = () => {
    if (!tournament?.id) return;
    navigator.clipboard.writeText(tournament.id).then(() => {
        setCopyStatus('Copied!');
        setTimeout(() => setCopyStatus('Copy Code'), 2000);
    }, () => {
        setError('Failed to copy code. Please copy it manually.');
    });
  };

  const player = useMemo(() => tournament?.players?.[playerName], [tournament, playerName]);
  const currentQuestionIndex = player?.currentQuestionIndex ?? 0;
  const currentQuestion = tournament?.questions?.[currentQuestionIndex];
  
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
        {isHost && tournament.id && (
            <div className='my-4'>
                <p className="text-gray-300">Share this Room Code:</p>
                <div className="flex justify-center items-center gap-2 mt-2">
                    <p className="text-xl sm:text-2xl font-bold bg-gray-900 p-2 rounded-lg select-all">{tournament.id}</p>
                    <button
                        onClick={handleCopyCode}
                        className={`px-4 py-2 rounded-lg text-white font-semibold ${copyStatus === 'Copied!' ? 'bg-green-600' : 'bg-purple-600 hover:bg-purple-700'}`}
                    >
                         {copyStatus}
                    </button>
                </div>
            </div>
        )}
        <p className="mb-4 text-gray-400">Game: <span className="font-semibold text-white">{gameTitles[tournament.gameType]}</span></p>
        <div className="bg-gray-900 p-4 rounded-lg mb-6">
          <h3 className="text-lg font-bold mb-2 text-purple-400">Players Joined</h3>
          <ul className="space-y-2">
            {sortedPlayers.map(p => <li key={p.id} className="text-white font-semibold text-xl">{p.name}</li>)}
          </ul>
        </div>
        {isHost ? (
          <button onClick={() => {
              setTournament(prev => {
                  if (!prev) return null;
                  const updated = {...prev, status: 'playing' as const };
                  setQuestionStartTime(Date.now());
                  return updated;
              })
          }} className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold">
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
    <div className="flex flex-col md:flex-row gap-6">
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
                    <input type="text" value={userInput} onChange={(e) => setUserInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submitAnswer()} placeholder="Type your answer..." className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-purple-500 focus:border-purple-500" />
                </div>
            ) : null}

            <button onClick={submitAnswer} disabled={(isTextInputGame ? !userInput : !selectedMcqId)} className="mt-4 w-full px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold disabled:opacity-50">
              Submit Answer
            </button>
        </div>

        <aside className="w-full md:w-64 flex-shrink-0 bg-gray-800 p-4 rounded-lg">
            <h3 className="text-xl font-bold mb-4 text-purple-400">Leaderboard</h3>
            <ul className="space-y-2">
              {sortedPlayers.map(p => (
                <li key={p.id} className={`p-2 rounded-lg flex justify-between ${p.name === playerName ? 'bg-purple-900' : 'bg-gray-700'}`}>
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