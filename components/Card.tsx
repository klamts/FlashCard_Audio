import React, { useState, useCallback, useRef } from 'react';
import type { FlashcardItem, ComparisonResult } from '../types';
import Spinner from './Spinner';

// Check for browser support for the Web Speech API.
const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
const isSpeechRecognitionSupported = !!SpeechRecognitionAPI;

interface CardProps {
  item: FlashcardItem;
  onGenerateImage: (id: string, prompt: string) => void;
  isTextHidden?: boolean;
  onCardClick?: (id: string) => void;
  isZoomed?: boolean;
  onCloseZoom?: () => void;
}

const Card: React.FC<CardProps> = ({ 
  item, 
  onGenerateImage,
  isTextHidden = false,
  onCardClick,
  isZoomed = false,
  onCloseZoom
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [userTranscript, setUserTranscript] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<ComparisonResult[] | null>(null);
  const [practiceError, setPracticeError] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const handleGenerateClick = () => {
    if (!item.isLoading && !item.imageUrl) {
      onGenerateImage(item.id, item.text);
    }
  };

  const comparePronunciation = (originalText: string, spokenText: string): ComparisonResult[] => {
    const originalDisplayWords = originalText.split(/\s+/).filter(Boolean);
    const originalComparisonWords = originalDisplayWords.map(w => w.toLowerCase().replace(/[^\w\s']|'/g, ''));
    const spokenComparisonWords = spokenText.toLowerCase().replace(/[^\w\s']|'/g, '').split(/\s+/).filter(Boolean);
    const spokenWordSet = new Set(spokenComparisonWords);

    return originalDisplayWords.map((word, index) => ({
      word: word,
      isCorrect: spokenWordSet.has(originalComparisonWords[index]),
    }));
  };

  const handlePracticeClick = useCallback(() => {
    if (!isSpeechRecognitionSupported) {
      setPracticeError("Speech recognition is not supported in this browser.");
      return;
    }

    if (isRecording) {
      recognitionRef.current?.stop();
      return;
    }

    setPracticeError(null);
    setUserTranscript(null);
    setComparisonResult(null);

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognitionRef.current = recognition;

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setUserTranscript(transcript);
      const result = comparePronunciation(item.text, transcript);
      setComparisonResult(result);
    };
    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === 'not-allowed' || event.error === 'permission-denied') {
        setPracticeError("Microphone access denied. Please enable it in browser settings.");
      } else if (event.error === 'no-speech'){
        setPracticeError("No speech was detected. Please try again.");
      } else {
        setPracticeError(`Error: ${event.error}`);
      }
    };
    recognition.onend = () => {
      setIsRecording(false);
      recognitionRef.current = null;
    };

    recognition.start();
  }, [isRecording, item.text]);

  const textClasses = isTextHidden && !isZoomed
    ? 'text-transparent bg-gray-600 rounded-md select-none blur-sm group-hover/card:blur-none group-hover/card:bg-transparent group-hover/card:text-white transition-all'
    : 'text-white';


  return (
    <div
      className={`bg-gray-800 rounded-lg shadow-lg overflow-hidden flex flex-col transition-all duration-300 group/card ${
        !isZoomed ? 'hover:shadow-cyan-500/50 hover:scale-105 cursor-pointer' : 'relative'
      }`}
      onClick={!isZoomed ? () => onCardClick?.(item.id) : undefined}
      aria-labelledby={`card-title-${item.id}`}
    >
       {isZoomed && (
        <button
          onClick={onCloseZoom}
          className="absolute top-2 right-2 z-20 p-1 bg-gray-900/60 rounded-full text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-white"
          aria-label="Close zoomed view"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      <div className="relative aspect-square w-full bg-gray-700 flex items-center justify-center">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.text} className="w-full h-full object-cover" />
        ) : (
          <div className="text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
        {item.isLoading && (
          <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center z-10">
            <Spinner />
          </div>
        )}
      </div>
      <div className="p-4 flex flex-col flex-grow">
        <h3 id={`card-title-${item.id}`} className={`font-bold text-lg mb-2 flex-grow min-h-[2.5em] flex items-center ${textClasses}`}>
          <span>{item.text}</span>
        </h3>
        <audio controls src={item.audioUrl} className="w-full h-10 mb-3 rounded-lg">
          Your browser does not support the audio element.
        </audio>
        
        <div className="space-y-2">
            <button
              onClick={handleGenerateClick}
              disabled={item.isLoading || !!item.imageUrl || isRecording}
              className="w-full px-4 py-2 text-sm font-semibold text-white rounded-md transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed
                         bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 focus:ring-purple-500"
            >
              {item.isLoading ? 'Generating...' : item.imageUrl ? 'Image Generated' : 'Generate Image'}
            </button>
            <button
                onClick={handlePracticeClick}
                disabled={item.isLoading || !isSpeechRecognitionSupported}
                className={`w-full px-4 py-2 text-sm font-semibold text-white rounded-md transition-colors duration-300 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800
                            ${isRecording ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500' : 'bg-cyan-600 hover:bg-cyan-700 focus:ring-cyan-500'}
                            ${!isSpeechRecognitionSupported ? 'bg-gray-600 cursor-not-allowed' : ''}`}
                title={!isSpeechRecognitionSupported ? "Speech recognition not supported" : "Practice your pronunciation"}
            >
                {isRecording ? (
                    <span className="flex items-center justify-center">
                         <svg className="animate-pulse -ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                           <path d="M5.25 5.25A.75.75 0 004.5 6v8a.75.75 0 00.75.75h8a.75.75 0 00.75-.75V6a.75.75 0 00-.75-.75h-8z" />
                         </svg>
                        Recording...
                    </span>
                ) : (
                    <span className="flex items-center justify-center">
                        <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                           <path d="M7 4a3 3 0 016 0v6a3 3 0 11-6 0V4z" />
                           <path d="M10 14a5 5 0 005-5h-1.5a.5.5 0 010-1H15a6.5 6.5 0 01-13 0H.5a.5.5 0 010-1H2a5 5 0 005 5v2.5a.5.5 0 001 0V14z" />
                        </svg>
                         Practice Pronunciation
                    </span>
                )}
            </button>
        </div>
        
        {(userTranscript || practiceError || comparisonResult) && (
             <div className="mt-4 p-3 bg-gray-700 rounded-lg text-sm">
                 {practiceError ? (
                    <p className="text-red-400 font-semibold">{practiceError}</p>
                 ) : comparisonResult && (
                    <>
                        <p className="text-gray-300 mb-1">
                            Your attempt: <span className="italic text-white">"{userTranscript}"</span>
                        </p>
                        <div className="font-semibold text-lg">
                           {comparisonResult.map((res, index) => (
                                <span key={index} className={res.isCorrect ? 'text-green-400' : 'text-red-400'}>
                                    {res.word}{' '}
                                </span>
                           ))}
                        </div>
                    </>
                 )}
             </div>
        )}
      </div>
    </div>
  );
};

export default Card;