// Flashcard types and interfaces for RecallAI

export type FlashcardType = 'qa' | 'cloze' | 'definition';

export interface Flashcard {
  id: string;
  type: FlashcardType;
  question: string;
  answer: string;
  source_text?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  created_at: string;
}

export interface Deck {
  id: string;
  title: string;
  userId: string;
  createdAt: Date;
  updatedAt?: Date;
  status: 'processing' | 'completed' | 'failed';
  source_type?: 'documents' | 'audio';
  model_used?: string;
  
  // Basic statistics
  total_cards?: number;
  
  // Additional metadata that may exist in Firestore
  error_message?: string;
  
  // Audio-specific metadata (if applicable)
  transcription?: {
    text: string;
    language: string;
    duration: number;
    segments_count: number;
  };
  audio_info?: {
    duration_minutes: number;
    file_size_mb: number;
    format: string;
  };
}

// AI Service Response Types
export interface AIServiceResponse {
  success: boolean;
  flashcards: Flashcard[];
  count: number;
  model?: string;
  error?: string;
}

export interface AIServiceRequest {
  text: string;
  num_cards?: number;
}

// Export format types
export type ExportFormat = 'anki' | 'quizlet-csv' | 'quizlet-txt' | 'csv' | 'json' | 'txt';

export interface ExportOptions {
  format: ExportFormat;
  includeSource?: boolean;
  includeDifficulty?: boolean;
  cardTypes?: FlashcardType[];
}

// Utility types for filtering and sorting
export type CardFilter = 'all' | 'qa' | 'cloze' | 'definition';
export type CardSort = 'created' | 'difficulty' | 'type';