export type ReviewResult = 'correct' | 'incorrect';

export interface WordBook {
  id: string;
  name: string;
  chapterSize?: number;
  createdAt: string;
  updatedAt: string;
}

export interface WordEntry {
  id: string;
  bookId: string;
  word: string;
  meaning?: string;
  phonetic?: string;
  example?: string;
  exampleTranslate?: string;
  chapter?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewState {
  wordId: string;
  lastResult: ReviewResult | null;
  correctCount: number;
  wrongCount: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
}

export interface DictationAttempt {
  id: string;
  wordId: string;
  typedAnswer: string;
  isCorrect: boolean;
  answeredAt: string;
}

export interface StudyProgress {
  bookId: string;
  chapter: number;
  size: number;
  currentIndex: number;
  completedCount: number;
  totalWords: number;
  updatedAt: string;
}

export interface AppData {
  version: 1;
  books: WordBook[];
  words: WordEntry[];
  reviewStates: Record<string, ReviewState>;
  attempts: DictationAttempt[];
  studyProgress: Record<string, StudyProgress>;
}

export interface WordInput {
  word: string;
  meaning?: string;
  phonetic?: string;
  example?: string;
  exampleTranslate?: string;
  chapter?: string;
  notes?: string;
}
