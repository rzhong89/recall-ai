// Frontend utility for Anki export functionality

import { Flashcard } from '@/types/flashcard';

const AI_SERVICE_URL = "http://localhost:8080";

export interface AnkiExportResponse {
  success: boolean;
  filename: string;
  data: string; // base64 encoded .apkg file
  size: number;
  cards_exported: number;
  error?: string;
}

export async function exportToAnki(
  cards: Flashcard[], 
  deckName: string
): Promise<void> {
  try {
    console.log(`Exporting ${cards.length} cards to Anki deck: ${deckName}`);
    
    const response = await fetch(`${AI_SERVICE_URL}/export-anki`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        flashcards: cards,
        deck_name: deckName
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const result: AnkiExportResponse = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to export to Anki');
    }

    // Convert base64 to blob and trigger download
    const binaryString = atob(result.data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const blob = new Blob([bytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    
    // Create download link
    const a = document.createElement('a');
    a.href = url;
    a.download = result.filename;
    a.style.display = 'none';
    
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Clean up
    URL.revokeObjectURL(url);
    
    console.log(`Successfully exported ${result.cards_exported} cards to ${result.filename}`);
    
  } catch (error) {
    console.error('Error exporting to Anki:', error);
    throw error;
  }
}