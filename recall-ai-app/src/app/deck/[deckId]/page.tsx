'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import { useAuth } from '@/hooks/useAuth';
import { Deck, Flashcard, ExportFormat } from '@/types/flashcard';
import { exportToAnki } from '@/lib/ankiExport';

export default function DeckDetailPage() {
  const { user } = useAuth();
  const params = useParams();
  const deckId = params.deckId as string;

  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const fetchDeckAndCards = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const decodedDeckId = decodeURIComponent(deckId);
        
        // Fetch deck info
        const deckRef = doc(db, 'decks', decodedDeckId);
        const deckSnap = await getDoc(deckRef);
        
        if (!deckSnap.exists()) {
          setError('Deck not found');
          return;
        }

        const deckData = {
          id: deckSnap.id,
          ...deckSnap.data(),
          createdAt: deckSnap.data().createdAt?.toDate() || new Date(),
          updatedAt: deckSnap.data().updatedAt?.toDate() || null,
        } as Deck;

        setDeck(deckData);

        // Fetch cards
        const cardsRef = collection(db, 'decks', decodedDeckId, 'cards');
        const cardsSnap = await getDocs(cardsRef);
        
        const cardsData = cardsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          created_at: doc.data().created_at?.toDate?.() || new Date(),
        })) as Flashcard[];

        setCards(cardsData);
        
        // Select all cards by default
        setSelectedCards(new Set(cardsData.map(card => card.id)));
      } catch (err) {
        console.error("Error fetching deck:", err);
        setError("Failed to load deck");
      }
      setLoading(false);
    };

    fetchDeckAndCards();
  }, [user, deckId]);

  const handleCardToggle = (cardId: string) => {
    const newSelected = new Set(selectedCards);
    if (newSelected.has(cardId)) {
      newSelected.delete(cardId);
    } else {
      newSelected.add(cardId);
    }
    setSelectedCards(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedCards.size === cards.length) {
      setSelectedCards(new Set());
    } else {
      setSelectedCards(new Set(cards.map(card => card.id)));
    }
  };

  const handleExport = async () => {
    const selectedCardData = cards.filter(card => selectedCards.has(card.id));
    
    if (selectedCardData.length === 0) {
      alert('Please select at least one card to export');
      return;
    }

    setExporting(true);

    try {
      // Handle Anki export separately
      if (exportFormat === 'anki') {
        await exportToAnki(selectedCardData, deck?.title || 'FlashGen Export');
        alert(`Successfully exported ${selectedCardData.length} cards to Anki!`);
        setExporting(false);
        return;
      }

      // Generate export content based on format for other formats
      let content = '';
      let filename = `${deck?.title || 'flashcards'}.${exportFormat === 'csv' ? 'csv' : 'txt'}`;
      let mimeType = 'text/plain';

      switch (exportFormat) {
        case 'csv':
          mimeType = 'text/csv';
          content = 'Front,Back,Type,Difficulty\n';
          content += selectedCardData.map(card => 
            `"${card.question.replace(/"/g, '""')}","${card.answer.replace(/"/g, '""')}","${card.type}","${card.difficulty || 'medium'}"`
          ).join('\n');
          break;
        
        case 'quizlet-csv':
          mimeType = 'text/csv';
          filename = `${deck?.title || 'flashcards'}.csv`;
          content = 'Term,Definition\n';
          content += selectedCardData.map(card => 
            `"${card.question.replace(/"/g, '""')}","${card.answer.replace(/"/g, '""')}"`
          ).join('\n');
          break;
        
        case 'quizlet-txt':
          content = selectedCardData.map(card => 
            `${card.question}\t${card.answer}`
          ).join('\n');
          break;
        
        case 'json':
          mimeType = 'application/json';
          filename = `${deck?.title || 'flashcards'}.json`;
          content = JSON.stringify({
            deck: {
              title: deck?.title,
              total_cards: selectedCardData.length,
              exported_at: new Date().toISOString()
            },
            cards: selectedCardData
          }, null, 2);
          break;
        
        case 'txt':
          content = selectedCardData.map((card, index) => 
            `Card ${index + 1}:\nQ: ${card.question}\nA: ${card.answer}\n---\n`
          ).join('\n');
          break;
        
        default:
          alert('Export format not yet implemented');
          setExporting(false);
          return;
      }

      // Download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading deck...</p>
          </div>
        </div>
      </AuthGuard>
    );
  }

  if (error || !deck) {
    return (
      <AuthGuard>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <p className="text-red-600 text-lg mb-4">{error || 'Deck not found'}</p>
            <Link href="/decks" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700">
              Back to Collections
            </Link>
          </div>
        </div>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4">
          {/* Header */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{deck.title}</h1>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <span className={`px-2 py-1 rounded text-xs ${
                    deck.status === 'completed' ? 'bg-green-100 text-green-800' : 
                    deck.status === 'failed' ? 'bg-red-100 text-red-800' : 
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {deck.status}
                  </span>
                  {deck.source_type && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                      {deck.source_type === 'documents' ? '📄 Document' : '🎵 Audio'}
                    </span>
                  )}
                  <span className="text-gray-500">
                    {cards.length} cards total
                  </span>
                </div>
              </div>
              <Link 
                href="/decks" 
                className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
              >
                ← Back to Collections
              </Link>
            </div>
          </div>

          {/* Export Controls */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Export Flashcards</h2>
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Export Format
                </label>
                <select
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="csv">CSV (General)</option>
                  <option value="quizlet-csv">Quizlet CSV</option>
                  <option value="quizlet-txt">Quizlet Text</option>
                  <option value="json">JSON</option>
                  <option value="txt">Plain Text</option>
                  <option value="anki">Anki (.apkg)</option>
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Selected Cards
                </label>
                <div className="flex items-center gap-4">
                  <button
                    onClick={handleSelectAll}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    {selectedCards.size === cards.length ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-sm text-gray-600">
                    {selectedCards.size} of {cards.length} selected
                  </span>
                </div>
              </div>
              <button
                onClick={handleExport}
                disabled={selectedCards.size === 0 || exporting}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {exporting && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                {exporting ? 'Exporting...' : 'Export Cards'}
              </button>
            </div>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {cards.map((card) => (
              <div
                key={card.id}
                className={`bg-white rounded-lg shadow-sm border-2 transition-all cursor-pointer ${
                  selectedCards.has(card.id) 
                    ? 'border-blue-500 ring-2 ring-blue-200' 
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => handleCardToggle(card.id)}
              >
                <div className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <span className={`px-2 py-1 text-xs rounded font-medium ${
                      card.type === 'qa' ? 'bg-blue-100 text-blue-700' :
                      card.type === 'cloze' ? 'bg-purple-100 text-purple-700' :
                      'bg-green-100 text-green-700'
                    }`}>
                      {card.type.toUpperCase()}
                    </span>
                    <input
                      type="checkbox"
                      checked={selectedCards.has(card.id)}
                      onChange={() => handleCardToggle(card.id)}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                    />
                  </div>
                  
                  <div className="mb-3">
                    <h3 className="font-medium text-gray-900 text-sm mb-2">Question:</h3>
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {card.question}
                    </p>
                  </div>
                  
                  <div>
                    <h3 className="font-medium text-gray-900 text-sm mb-2">Answer:</h3>
                    <p className="text-gray-700 text-sm leading-relaxed">
                      {card.answer}
                    </p>
                  </div>
                  
                  {card.difficulty && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      <span className={`px-2 py-1 text-xs rounded ${
                        card.difficulty === 'easy' ? 'bg-green-100 text-green-700' :
                        card.difficulty === 'hard' ? 'bg-red-100 text-red-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>
                        {card.difficulty}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {cards.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-600 text-lg">No flashcards found in this deck.</p>
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}