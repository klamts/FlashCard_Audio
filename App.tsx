import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AUDIO_URLS } from './constants';
import { FlashcardItem, GameType } from './types';
import Card from './components/Card';
import GameSelectionModal from './components/GameSelectionModal';
import GameMode from './components/GameMode';
import TournamentLobby from './components/TournamentLobby';
import { generateImageFromPrompt } from './services/geminiService';

type ViewState = 
  | { mode: 'deck' }
  | { mode: 'localGame'; gameType: GameType }
  | { mode: 'tournament' };

const isFirebaseConfigured = !!window.firestore;

const App: React.FC = () => {
  const [flashcards, setFlashcards] = useState<FlashcardItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState('');
  const [isImportingUrl, setIsImportingUrl] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isTextHidden, setIsTextHidden] = useState(false);
  const [zoomedCardId, setZoomedCardId] = useState<string | null>(null);
  const [isGameModalOpen, setIsGameModalOpen] = useState(false);
  const [viewState, setViewState] = useState<ViewState>({ mode: 'deck' });

  useEffect(() => {
    const parsedFlashcards = AUDIO_URLS.map(url => {
      const filename = url.split('/').pop() || '';
      const text = decodeURIComponent(filename)
        .replace(/\.mp3$/, '')
        .replace(/%20/g, ' ')
        .trim();
      return {
        id: url,
        text: text.charAt(0).toUpperCase() + text.slice(1),
        audioUrl: url,
        imageUrl: null,
        isLoading: false,
      };
    });
    setFlashcards(parsedFlashcards);
  }, []);

  const handleGenerateImage = useCallback(async (id: string, prompt: string) => {
    setFlashcards(prev =>
      prev.map(card => (card.id === id ? { ...card, isLoading: true } : card))
    );
    setError(null);

    try {
      const fullPrompt = `A simple, cute, cartoon-style illustration for a children's flashcard, with a clean, solid light-colored background. The image should clearly and simply depict: ${prompt}`;
      const imageUrl = await generateImageFromPrompt(fullPrompt);
      setFlashcards(prev =>
        prev.map(card =>
          card.id === id ? { ...card, imageUrl, isLoading: false } : card
        )
      );
    } catch (err) {
      console.error('Failed to generate image:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to generate image for "${prompt}". ${errorMessage}`);
      setFlashcards(prev =>
        prev.map(card => (card.id === id ? { ...card, isLoading: false } : card))
      );
    }
  }, []);

  const handleGenerateAll = async () => {
     for (const card of flashcards) {
        if (!card.imageUrl && !card.isLoading) {
            await handleGenerateImage(card.id, card.text);
        }
    }
  };
  
  const handleExport = () => {
    if (flashcards.length === 0) {
        setError("There are no flashcards to export.");
        return;
    }
    const jsonString = JSON.stringify(flashcards, null, 2);
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "flashcards-deck.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const processAndSetImportedData = (data: any[]) => {
    if (!Array.isArray(data) || data.some(item => typeof item.id === 'undefined' || typeof item.text === 'undefined')) {
      throw new Error("Invalid JSON structure. Expected an array of flashcard items.");
    }

    const validatedData = data.map(item => ({
      id: item.id,
      text: item.text,
      audioUrl: item.audioUrl,
      imageUrl: item.imageUrl || null,
      isLoading: false,
    }));
    
    setFlashcards(validatedData);
    setError(null);
  };

  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result;
        if (typeof text !== 'string') throw new Error("File could not be read properly.");
        const importedData = JSON.parse(text);
        processAndSetImportedData(importedData);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
        setError(`Failed to import file. Please ensure it's a valid JSON. Error: ${errorMessage}`);
      }
    };
    reader.onerror = () => setError("Failed to read the selected file.");
    reader.readAsText(file);
    event.target.value = '';
  };

  const handleImportFromUrl = async () => {
    if (!importUrl) {
      setError("Please enter a URL to import.");
      return;
    }
    setIsImportingUrl(true);
    setError(null);
    try {
      const response = await fetch(importUrl);
      if (!response.ok) throw new Error(`Failed to fetch from URL: ${response.statusText}`);
      const importedData = await response.json();
      processAndSetImportedData(importedData);
      setImportUrl('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to import from URL. Please ensure it's a valid JSON link. Error: ${errorMessage}`);
    } finally {
      setIsImportingUrl(false);
    }
  };

  const handleCardClick = (id: string) => setZoomedCardId(id);
  const handleCloseZoom = () => setZoomedCardId(null);

  const handleStartGame = (gameType: GameType) => {
    const playableCards = flashcards.filter(c => c.imageUrl && c.audioUrl);
    const minCards = (gameType === 'audioToImage' || gameType === 'imageToAudio') ? 4 : 1;

    if (playableCards.length < minCards) {
      setError(`You need at least ${minCards} flashcards with generated images to play this game mode.`);
      setIsGameModalOpen(false);
      return;
    }
    setError(null);
    setViewState({ mode: 'localGame', gameType });
    setIsGameModalOpen(false);
  };

  const handleExitGame = () => setViewState({ mode: 'deck' });

  const zoomedCard = zoomedCardId ? flashcards.find(c => c.id === zoomedCardId) : null;

  const renderContent = () => {
    switch(viewState.mode) {
      case 'tournament':
        return <TournamentLobby flashcards={flashcards} onExit={handleExitGame} />;
      case 'localGame':
        return <GameMode gameType={viewState.gameType} flashcards={flashcards} onExit={handleExitGame} />;
      case 'deck':
      default:
        return flashcards.length === 0 ? (
          <div className="text-center text-gray-500 mt-10">
            <p>Loading flashcards... or you can import a deck.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
            {flashcards.map(card => (
              <Card 
                key={card.id} 
                item={card} 
                onGenerateImage={handleGenerateImage}
                isTextHidden={isTextHidden}
                onCardClick={handleCardClick}
              />
            ))}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
            Audio Flashcard Image Generator
          </h1>
          {viewState.mode === 'deck' && (
            <>
              <p className="mt-2 text-lg text-gray-400">
                Generate images, practice pronunciation, or compete in online tournaments.
              </p>
              <div className="mt-6 flex justify-center items-center gap-4 flex-wrap">
                 <button
                    onClick={handleGenerateAll}
                    className="px-6 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold shadow-lg transition-transform transform hover:scale-105"
                    >
                    Generate All Missing
                </button>
                <button
                    onClick={() => setIsGameModalOpen(true)}
                    className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-semibold shadow-lg transition-transform transform hover:scale-105"
                    >
                    Practice Game
                </button>
                 <button
                    onClick={() => {
                        if (!isFirebaseConfigured) {
                            setError("Firebase is not configured. Please follow the instructions in index.html to enable Online Tournaments.");
                            return;
                        }
                        setViewState({ mode: 'tournament' });
                    }}
                    disabled={!isFirebaseConfigured}
                    className="px-6 py-2 bg-amber-500 hover:bg-amber-600 rounded-lg text-white font-semibold shadow-lg transition-transform transform hover:scale-105 disabled:bg-gray-600 disabled:cursor-not-allowed disabled:transform-none"
                    title={!isFirebaseConfigured ? "Firebase not configured. Please see instructions in index.html." : "Compete against others online!"}
                    >
                    Online Tournament
                </button>
              </div>
              <div className="mt-4 flex justify-center items-center gap-4 flex-wrap">
                 <button
                    onClick={handleExport}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white font-semibold shadow-lg transition-transform transform hover:scale-105"
                    >
                    Export
                </button>
                <button
                    onClick={handleImportClick}
                    className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 rounded-lg text-white font-semibold shadow-lg transition-transform transform hover:scale-105"
                    >
                    Import File
                </button>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImport}
                    accept=".json,application/json"
                    className="hidden"
                    aria-hidden="true"
                />
              </div>
              <div className="mt-4 flex justify-center items-center gap-2 flex-wrap max-w-xl mx-auto">
                <input
                    type="url"
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    placeholder="Paste JSON URL to import"
                    className="flex-grow px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-purple-500 focus:border-purple-500 min-w-[200px]"
                    aria-label="Import from URL"
                    onKeyDown={(e) => e.key === 'Enter' && handleImportFromUrl()}
                />
                 <button
                    onClick={handleImportFromUrl}
                    disabled={isImportingUrl || !importUrl}
                    className="px-6 py-2 bg-teal-500 hover:bg-teal-600 rounded-lg text-white font-semibold shadow-lg transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isImportingUrl ? 'Importing...' : 'Import URL'}
                </button>
              </div>
              <div className="mt-6 flex items-center justify-center gap-3">
                    <label htmlFor="hide-text-toggle" className="font-semibold text-gray-300 select-none cursor-pointer">Hide Text Mode</label>
                    <div className="relative inline-block w-10 align-middle select-none transition duration-200 ease-in">
                        <input type="checkbox" id="hide-text-toggle" checked={isTextHidden} onChange={() => setIsTextHidden(!isTextHidden)} className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-400 checked:right-0 checked:border-purple-600" />
                        <label htmlFor="hide-text-toggle" className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-600 cursor-pointer"></label>
                    </div>
                    <style>{`.toggle-checkbox:checked{right:0;border-color:#9333ea;}.toggle-checkbox:checked+.toggle-label{background-color:#9333ea;}`}</style>
              </div>
            </>
          )}
        </header>
        
        {isGameModalOpen && <GameSelectionModal onSelectGame={handleStartGame} onClose={() => setIsGameModalOpen(false)} />}
        
        {error && (
          <div className="bg-red-900 border border-red-700 text-red-200 px-4 py-3 rounded-lg relative mb-6" role="alert">
            <strong className="font-bold">Error: </strong>
            <span className="block sm:inline">{error}</span>
            <button onClick={() => setError(null)} className="absolute top-0 bottom-0 right-0 px-4 py-3" aria-label="Close">
              <svg className="fill-current h-6 w-6 text-red-500" role="button" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><title>Close</title><path d="M14.348 14.849a1.2 1.2 0 0 1-1.697 0L10 11.819l-2.651 3.029a1.2 1.2 0 1 1-1.697-1.697l2.758-3.15-2.759-3.152a1.2 1.2 0 1 1 1.697-1.697L10 8.183l2.651-3.031a1.2 1.2 0 1 1 1.697 1.697l-2.758 3.152 2.758 3.15a1.2 1.2 0 0 1 0 1.698z"/></svg>
            </button>
          </div>
        )}

        {renderContent()}
      </div>

       {zoomedCard && viewState.mode === 'deck' && (
          <div
              className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 transition-opacity duration-300"
              onClick={handleCloseZoom}
              role="dialog"
              aria-modal="true"
              aria-labelledby={`card-title-${zoomedCard.id}`}
          >
              <div
                  onClick={e => e.stopPropagation()}
                  className="w-full max-w-lg"
              >
                  <Card
                      item={zoomedCard}
                      onGenerateImage={handleGenerateImage}
                      isZoomed={true}
                      onCloseZoom={handleCloseZoom}
                  />
              </div>
          </div>
       )}
    </div>
  );
};

export default App;