import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FlashcardItem, GameType, GameResult, ComparisonResult } from '../types';
import { shuffleArray, scrambleText, createBlanks, getRandomItems, compareText } from '../utils/gameUtils';
import Spinner from './Spinner';

const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSpeechRecognitionSupported = !!SpeechRecognitionAPI;

interface GameModeProps {
  gameType: GameType;
  flashcards: FlashcardItem[];
  onExit: () => void;
}

const gameTitles: Record<GameType, string> = {
  imageToText: 'Game: Image to Text',
  audioToText: 'Game: Audio to Text',
  scrambled: 'Game: Unscramble Words',
  fillInBlanks: 'Game: Fill in the Blanks',
  audioToImage: 'Game: Match Audio to Image',
  imageToAudio: 'Game: Match Image to Audio',
};

const GameMode: React.FC<GameModeProps> = ({ gameType, flashcards, onExit }) => {
  const [shuffledCards, setShuffledCards] = useState<FlashcardItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [gameState, setGameState] = useState<'playing' | 'feedback' | 'finished'>('playing');
  const [feedback, setFeedback] = useState<{ correct: boolean; result?: ComparisonResult[] | null } | null>(null);
  const [mcqOptions, setMcqOptions] = useState<FlashcardItem[]>([]);
  const [selectedMcqId, setSelectedMcqId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [practiceError, setPracticeError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [gameResults, setGameResults] = useState<GameResult[]>([]);

  const setupQuestion = useCallback((index: number, cards: FlashcardItem[], type: GameType, allCards: FlashcardItem[]) => {
    if (type === 'audioToImage' || type === 'imageToAudio') {
      const currentCard = cards[index];
      const randomOptions = getRandomItems(allCards, currentCard.id, 3);
      const allOptions = shuffleArray([...randomOptions, currentCard]);
      setMcqOptions(allOptions);
    }
  }, []);

  useEffect(() => {
    const playableCards = flashcards.filter(card => card.imageUrl && card.audioUrl);
    const newShuffledCards = shuffleArray(playableCards);
    setShuffledCards(newShuffledCards);
    setCurrentIndex(0);
    setScore(0);
    setGameState('playing');
    setGameResults([]); // Reset results for new game
    if (newShuffledCards.length > 0) {
      setupQuestion(0, newShuffledCards, gameType, flashcards);
      setQuestionStartTime(Date.now()); // Start timer for first question
    }
  }, [gameType, flashcards, setupQuestion]);

  const handleNextQuestion = useCallback(() => {
    const nextIndex = currentIndex + 1;
    if (nextIndex < shuffledCards.length) {
      setCurrentIndex(nextIndex);
      setUserInput('');
      setFeedback(null);
      setSelectedMcqId(null);
      setupQuestion(nextIndex, shuffledCards, gameType, flashcards);
      setQuestionStartTime(Date.now()); // Reset timer for the next question
      setGameState('playing');
    } else {
      setGameState('finished');
    }
  }, [currentIndex, shuffledCards, gameType, flashcards, setupQuestion]);

  const handleCheckAnswer = useCallback(() => {
    if (gameState !== 'playing' || !shuffledCards[currentIndex]) return;

    const timeTaken = Date.now() - questionStartTime;
    const currentCard = shuffledCards[currentIndex];
    const isMcq = gameType === 'audioToImage' || gameType === 'imageToAudio';
    let isCorrect = false;

    if (isMcq) {
      isCorrect = selectedMcqId === currentCard.id;
    } else {
      isCorrect = userInput.trim().toLowerCase() === currentCard.text.toLowerCase();
    }
    
    if (isCorrect) {
      setScore(s => s + 1);
    }

    const comparisonResult = (gameType === 'imageToText' || gameType === 'audioToText')
      ? compareText(currentCard.text, userInput)
      : null;

    setFeedback({ correct: isCorrect, result: comparisonResult });
    setGameState('feedback');

    const result: GameResult = {
      card: currentCard,
      status: isCorrect ? 'correct' : 'incorrect',
      userAnswer: isMcq ? selectedMcqId : userInput,
      timeTaken,
      comparison: comparisonResult,
    };
    setGameResults(prev => [...prev, result]);

    if (isMcq) {
      setTimeout(() => {
        handleNextQuestion();
      }, 2000);
    }
  }, [gameState, shuffledCards, currentIndex, userInput, selectedMcqId, gameType, handleNextQuestion, questionStartTime]);
  
  const handleSkipQuestion = useCallback(() => {
    if (gameState !== 'playing' || !shuffledCards[currentIndex]) return;

    const timeTaken = Date.now() - questionStartTime;
    const currentCard = shuffledCards[currentIndex];

    const result: GameResult = {
        card: currentCard,
        status: 'skipped',
        userAnswer: null,
        timeTaken,
        comparison: null,
    };
    setGameResults(prev => [...prev, result]);

    handleNextQuestion();
  }, [gameState, currentIndex, shuffledCards, questionStartTime, handleNextQuestion]);

  const handleExportResults = () => {
    if (gameResults.length === 0) return;
    const jsonString = JSON.stringify(gameResults, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    link.href = url;
    link.download = `game-results-${gameType}-${timestamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };


  const handlePracticeClick = useCallback(() => {
    if (!isSpeechRecognitionSupported) {
      setPracticeError("Speech recognition is not supported.");
      return;
    }
    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }
    setPracticeError(null);
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;
    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event) => setUserInput(event.results[0][0].transcript);
    recognition.onerror = (event) => {
       if (event.error === 'not-allowed') setPracticeError("Microphone access denied.");
       else setPracticeError(`Error: ${event.error}`);
    };
    recognition.onend = () => {
        setIsRecording(false);
        recognitionRef.current = null;
    };
    recognition.start();
  }, [isRecording]);

  if (shuffledCards.length === 0) {
    return <div className="text-center p-8"><Spinner /></div>;
  }
  
  if (gameState === 'finished') {
    return (
      <div className="text-center bg-gray-800 p-8 rounded-lg">
        <h2 className="text-3xl font-bold text-yellow-400 mb-4">Game Over!</h2>
        <p className="text-xl mb-4">Your final score: {score} / {shuffledCards.length}</p>
        
        <div className="mb-6 text-left max-h-60 overflow-y-auto bg-gray-900 p-4 rounded-lg">
          <h3 className="text-lg font-semibold mb-2 text-white">Review your answers:</h3>
          {gameResults.map((result, index) => (
            <div key={index} className={`p-2 rounded mb-2 ${result.status === 'correct' ? 'bg-green-900/50' : (result.status === 'incorrect' ? 'bg-red-900/50' : 'bg-yellow-900/50')}`}>
              <p className="font-bold">{result.card.text}</p>
              <p>Status: <span className={`font-semibold ${result.status === 'correct' ? 'text-green-400' : (result.status === 'incorrect' ? 'text-red-400' : 'text-yellow-400')}`}>{result.status}</span></p>
              {result.status !== 'correct' && <p>Your answer: <span className="italic">{result.userAnswer || 'N/A'}</span></p>}
              <p>Time: {(result.timeTaken / 1000).toFixed(2)}s</p>
            </div>
          ))}
        </div>

        <div className="flex justify-center gap-4">
          <button onClick={onExit} className="px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold">
            Back to Deck
          </button>
           <button onClick={handleExportResults} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold">
            Export Results
          </button>
        </div>
      </div>
    );
  }

  const currentCard = shuffledCards[currentIndex];
  const isTextInputGame = ['imageToText', 'audioToText', 'scrambled', 'fillInBlanks'].includes(gameType);

  const renderGameContent = () => {
    const isMcq = gameType === 'audioToImage' || gameType === 'imageToAudio';
    
    switch (gameType) {
      case 'imageToText':
      case 'scrambled':
      case 'fillInBlanks':
        return <img src={currentCard.imageUrl!} alt="Guess the word" className={`w-full h-64 object-contain rounded-lg mb-4 ${isMcq && selectedMcqId ? (currentCard.id === selectedMcqId ? (feedback?.correct ? 'ring-4 ring-green-500' : 'ring-4 ring-red-500') : '') : ''}`}/>;
      case 'audioToText':
        return <audio key={currentCard.id} controls autoPlay src={currentCard.audioUrl} className="w-full h-12 mb-4" />;
      case 'audioToImage':
        return (
          <>
            <audio key={currentCard.id} controls autoPlay src={currentCard.audioUrl} className="w-full h-12 mb-4" />
            <div className="grid grid-cols-2 gap-4">
              {mcqOptions.map(option => (
                <img
                  key={option.id}
                  src={option.imageUrl!}
                  alt="Option"
                  onClick={() => gameState === 'playing' && setSelectedMcqId(option.id)}
                  className={`w-full h-40 object-cover rounded-lg cursor-pointer transition-all ${selectedMcqId === option.id ? 'scale-105 ring-4 ring-blue-500' : 'opacity-80 hover:opacity-100'}
                  ${gameState === 'feedback' && option.id === currentCard.id ? 'ring-4 ring-green-500' : ''}
                  ${gameState === 'feedback' && option.id === selectedMcqId && !feedback?.correct ? 'ring-4 ring-red-500' : ''}
                  `}
                />
              ))}
            </div>
          </>
        );
       case 'imageToAudio':
        return (
          <>
            <img src={currentCard.imageUrl!} alt="Match the audio" className="w-full h-64 object-contain rounded-lg mb-4" />
            <div className="grid grid-cols-2 gap-4">
                {mcqOptions.map(option => (
                    <button
                        key={option.id}
                        onClick={() => gameState === 'playing' && setSelectedMcqId(option.id)}
                        className={`p-4 rounded-lg flex items-center justify-center gap-2 transition-all 
                        ${selectedMcqId === option.id ? 'bg-blue-600' : 'bg-gray-700 hover:bg-gray-600'}
                        ${gameState === 'feedback' && option.id === currentCard.id ? '!bg-green-600' : ''}
                        ${gameState === 'feedback' && option.id === selectedMcqId && !feedback?.correct ? '!bg-red-600' : ''}
                        `}
                    >
                         <audio src={option.audioUrl} controls onPlay={e => { e.stopPropagation(); }} className="h-10 w-full"></audio>
                    </button>
                ))}
            </div>
          </>
        );
      default: return null;
    }
  };
  
  return (
    <div className="bg-gray-800 p-4 sm:p-6 rounded-lg shadow-2xl max-w-2xl mx-auto">
      <header className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">{gameTitles[gameType]}</h2>
        <div className="text-lg font-semibold">Score: {score}</div>
        <button onClick={onExit} className="text-gray-400 hover:text-white">&times; Exit</button>
      </header>

      <div className="mb-4 text-center">
        {gameType === 'scrambled' && <p className="text-2xl font-bold tracking-widest my-4 p-2 bg-gray-700 rounded">{scrambleText(currentCard.text)}</p>}
        {gameType === 'fillInBlanks' && <p className="text-2xl font-bold tracking-widest my-4">{createBlanks(currentCard.text)}</p>}
      </div>

      <div>{renderGameContent()}</div>

      {isTextInputGame && (
        <div className="mt-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && gameState === 'playing' && handleCheckAnswer()}
              placeholder="Type your answer here..."
              disabled={gameState === 'feedback'}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-purple-500 focus:border-purple-500"
            />
            {isSpeechRecognitionSupported && (
              <button onClick={handlePracticeClick} disabled={gameState === 'feedback'} className={`p-2 rounded-full ${isRecording ? 'bg-red-500 animate-pulse' : 'bg-cyan-600'}`}>
                <svg className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor"><path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" /><path d="M10 14a5 5 0 005-5h-1.5a.5.5 0 010-1H15a6.5 6.5 0 01-13 0H.5a.5.5 0 010-1H2a5 5 0 005 5v2.5a.5.5 0 001 0V14z" /></svg>
              </button>
            )}
          </div>
           {practiceError && <p className="text-red-400 text-sm mt-1">{practiceError}</p>}
        </div>
      )}
      
      {gameState === 'playing' && (
        <div className="flex gap-2 mt-4">
            <button
              onClick={handleCheckAnswer}
              disabled={isTextInputGame ? !userInput : !selectedMcqId}
              className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
              Check Answer
            </button>
            <button
                onClick={handleSkipQuestion}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-semibold">
                Skip
            </button>
        </div>
      )}

      {gameState === 'feedback' && (
        <div className="mt-4">
          <div className={`p-4 rounded-lg text-center ${feedback?.correct ? 'bg-green-900' : 'bg-red-900'}`}>
            <h3 className="text-2xl font-bold">{feedback?.correct ? 'Correct!' : 'Incorrect!'}</h3>
            {!feedback?.correct && <p className="mt-1">Correct answer: <span className="font-bold">{currentCard.text}</span></p>}
            {feedback?.result && (
              <div className="mt-2 font-semibold text-lg">
                {feedback.result.map((res, index) => (
                  <span key={index} className={res.isCorrect ? 'text-green-300' : 'text-red-300'}>{res.word}{' '}</span>
                ))}
              </div>
            )}
          </div>
          {isTextInputGame && (
             <button onClick={handleNextQuestion} className="mt-4 w-full px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-semibold">
                Next Question
             </button>
          )}
        </div>
      )}

      <div className="text-center mt-4 text-gray-400">Question {currentIndex + 1} of {shuffledCards.length}</div>
    </div>
  );
};

export default GameMode;