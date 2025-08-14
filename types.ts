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

// New Types for LAN Tournaments
export interface TournamentPlayer {
    id: string; // Corresponds to peer ID for clients, or name for host
    name: string;
    score: number;
    currentQuestionIndex: number;
    isFinished: boolean;
}

export interface Tournament {
    id: string; // Room Code / Host's Peer ID
    gameType: GameType;
    status: 'waiting' | 'playing' | 'finished';
    questions: FlashcardItem[];
    players: { [key: string]: TournamentPlayer }; // Using a map for easy player lookup
    creatorId: string; // Host's name
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
    Peer: any; // Add PeerJS to the global window object
  }
}
