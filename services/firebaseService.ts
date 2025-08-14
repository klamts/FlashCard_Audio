import {
  collection,
  doc,
  addDoc,
  getDocs,
  onSnapshot,
  updateDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  writeBatch,
  getDoc,
  setDoc,
} from 'firebase/firestore';
import { GameType, FlashcardItem, Tournament, TournamentPlayer } from '../types';

// This service assumes `window.firestore` has been initialized in `index.html`
const db = window.firestore;

if (!db) {
  console.error("Firestore is not initialized. Tournament functionality will be disabled.");
}

const tournamentsCollection = db ? collection(db, 'tournaments') : null;

export const createTournament = async (
  creatorName: string,
  gameType: GameType,
  questions: FlashcardItem[]
): Promise<string> => {
  if (!tournamentsCollection) throw new Error("Firestore not initialized");

  // Sanitize questions to ensure they are plain objects and remove unnecessary data.
  // This prevents "circular structure" errors when saving to Firestore.
  const sanitizedQuestions = questions.map(q => ({
    id: q.id,
    text: q.text,
    audioUrl: q.audioUrl,
    imageUrl: q.imageUrl,
  }));

  const newTournamentRef = await addDoc(tournamentsCollection, {
    gameType,
    questions: sanitizedQuestions,
    status: 'waiting',
    creatorId: creatorName,
    createdAt: serverTimestamp(),
    players: {
      [creatorName]: {
        id: creatorName,
        name: creatorName,
        score: 0,
        currentQuestionIndex: 0,
        isFinished: false,
      },
    },
  });
  return newTournamentRef.id;
};

export const joinTournament = async (tournamentId: string, playerName: string): Promise<void> => {
  if (!db) throw new Error("Firestore not initialized");
  const tournamentRef = doc(db, 'tournaments', tournamentId);
  
  const newPlayer: TournamentPlayer = {
    id: playerName,
    name: playerName,
    score: 0,
    currentQuestionIndex: 0,
    isFinished: false,
  };

  // Use a transaction or batched write to safely add a player
  await updateDoc(tournamentRef, {
    [`players.${playerName}`]: newPlayer,
  });
};

export const startTournament = async (tournamentId: string): Promise<void> => {
    if (!db) throw new Error("Firestore not initialized");
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    await updateDoc(tournamentRef, { status: 'playing' });
};

export const updatePlayerState = async (
  tournamentId: string,
  playerId: string,
  updates: Partial<TournamentPlayer>
): Promise<void> => {
  if (!db) throw new Error("Firestore not initialized");
  const tournamentRef = doc(db, 'tournaments', tournamentId);

  const playerUpdates: { [key: string]: any } = {};
  for (const key in updates) {
    playerUpdates[`players.${playerId}.${key}`] = (updates as any)[key];
  }

  await updateDoc(tournamentRef, playerUpdates);
};

export const checkAndFinishTournament = async (tournamentId: string): Promise<void> => {
    if (!db) throw new Error("Firestore not initialized");
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    const docSnap = await getDoc(tournamentRef);

    if (docSnap.exists()) {
        const tournament = docSnap.data() as Tournament;
        const allPlayersFinished = Object.values(tournament.players).every(p => p.isFinished);
        if (allPlayersFinished) {
            await updateDoc(tournamentRef, { status: 'finished' });
        }
    }
}

export const onTournamentsListUpdate = (
  callback: (tournaments: Tournament[]) => void
): (() => void) => {
  if (!tournamentsCollection) return () => {};

  const q = query(
    tournamentsCollection, 
    where('status', '==', 'waiting'), 
    orderBy('createdAt', 'desc'), 
    limit(20)
  );

  return onSnapshot(q, (snapshot) => {
    const tournaments = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Tournament));
    callback(tournaments);
  }, (error) => {
    console.error("Error listening to tournaments:", error);
  });
};

export const onTournamentUpdate = (
  tournamentId: string,
  callback: (tournament: Tournament | null) => void
): (() => void) => {
  if (!db) return () => {};
  const tournamentRef = doc(db, 'tournaments', tournamentId);
  return onSnapshot(tournamentRef, (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() } as Tournament);
    } else {
      callback(null);
    }
  }, (error) => {
    console.error(`Error listening to tournament ${tournamentId}:`, error);
  });
};