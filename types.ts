export interface FlashcardItem {
  id: string;
  text: string;
  audioUrl: string;
  imageUrl: string | null;
  isLoading: boolean;
}

export type GameType = 'imageToText' | 'audioToText' | 'scrambled' | 'fillInBlanks' | 'audioToImage' | 'imageToAudio';

// Centralized type for word-by-word comparison results.
export type ComparisonResult = {
  word: string;
  isCorrect: boolean;
};

// New type for storing the result of a single game question.
export interface GameResult {
  card: FlashcardItem;
  status: 'correct' | 'incorrect' | 'skipped';
  userAnswer: string | null;
  timeTaken: number; // in milliseconds
  comparison?: ComparisonResult[] | null;
}

// A version of FlashcardItem for storing in Firestore, without client-side state.
export interface TournamentQuestion {
  id: string;
  text: string;
  audioUrl: string;
  imageUrl: string | null;
}

// New Types for Online Tournaments
export interface TournamentPlayer {
    id: string; // Corresponds to user-entered name, should be unique within tournament
    name: string;
    score: number;
    currentQuestionIndex: number;
    isFinished: boolean;
}

export interface Tournament {
    id: string;
    gameType: GameType;
    status: 'waiting' | 'playing' | 'finished';
    questions: TournamentQuestion[]; // Use the cleaner data type
    players: { [key: string]: TournamentPlayer }; // Using a map for easy player lookup
    creatorId: string;
    createdAt: any; // Firestore Timestamp
}


// Adding Web Speech API types for browsers that support it.
// This will fix the TypeScript errors in Card.tsx.

declare global {
  interface SpeechRecognitionEvent extends Event {
    readonly results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
  }

  interface SpeechRecognitionResult {
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
  }

  interface SpeechRecognitionAlternative {
    readonly transcript: string;
  }

  interface SpeechRecognitionErrorEvent extends Event {
    readonly error: string;
  }

  interface SpeechRecognition extends EventTarget {
    lang: string;
    continuous: boolean;
    interimResults: boolean;
    start(): void;
    stop(): void;
    onstart: (() => void) | null;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
  }

  interface SpeechRecognitionStatic {
    new (): SpeechRecognition;
  }
  
  interface Window {
    SpeechRecognition: SpeechRecognitionStatic;
    webkitSpeechRecognition: SpeechRecognitionStatic;
    firestore: any;
  }
}