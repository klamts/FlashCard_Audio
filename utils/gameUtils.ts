import { FlashcardItem, ComparisonResult } from '../types';

export const shuffleArray = <T,>(array: T[]): T[] => {
  return [...array].sort(() => Math.random() - 0.5);
};

export const scrambleText = (text: string): string => {
  const words = text.split(' ');
  const scrambledWords = words.map(word => {
    if (word.length <= 2) return word;
    const chars = Array.from(word);
    for (let i = chars.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [chars[i], chars[j]] = [chars[j], chars[i]];
    }
    return chars.join('');
  });
  return scrambledWords.join(' ');
};

export const createBlanks = (text: string, numBlanks: number = 2): string => {
  let result = text;
  const indices: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i].match(/[a-zA-Z0-9]/)) {
      indices.push(i);
    }
  }

  const shuffledIndices = shuffleArray(indices);
  const charsToBlank = Math.min(numBlanks, shuffledIndices.length);
  const indicesToReplace = new Set(shuffledIndices.slice(0, charsToBlank));
  
  let blankedResult = '';
  for(let i=0; i<text.length; i++) {
    blankedResult += indicesToReplace.has(i) ? '_' : text[i];
  }

  return blankedResult;
};

export const getRandomItems = (arr: FlashcardItem[], currentId: string, count: number): FlashcardItem[] => {
  const otherItems = arr.filter(item => item.id !== currentId && item.imageUrl);
  const shuffled = shuffleArray(otherItems);
  return shuffled.slice(0, count);
};

export const compareText = (originalText: string, spokenText: string): ComparisonResult[] => {
    const originalDisplayWords = originalText.split(/\s+/).filter(Boolean);
    const normalize = (s: string) => s.toLowerCase().replace(/[^\w\s']+/g, '');

    const spokenWords = normalize(spokenText).split(/\s+/).filter(Boolean);
    const spokenWordSet = new Set(spokenWords);

    return originalDisplayWords.map(word => {
      const normalizedOriginalWord = normalize(word);
      return {
          word: word,
          isCorrect: spokenWordSet.has(normalizedOriginalWord)
      }
    });
};