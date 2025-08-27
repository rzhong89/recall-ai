'use client';

import { useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import Link from 'next/link';
import AuthGuard from '@/components/AuthGuard';
import { useAuth } from '@/hooks/useAuth';
import { Deck } from '@/types/flashcard';

export default function DecksPage() {
  const { user } = useAuth();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDecks = async () => {
      if (!user) return;
      
      setLoading(true);
      try {
        const q = query(collection(db, 'decks'), where('userId', '==', user.uid));
        const querySnapshot = await getDocs(q);
        const fetchedDecks = querySnapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || null,
          } as unknown as Deck;
        });
        
        console.log('Fetched decks:', fetchedDecks);
        console.log('Raw deck docs:', querySnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() })));
        
        setDecks(fetchedDecks);
      } catch (error) {
        console.error("Error fetching decks:", error);
      }
      setLoading(false);
    };

    fetchDecks();
  }, [user]);

  if (loading) {
    return <div className="text-center mt-10">Loading decks...</div>;
  }

  return (
    <AuthGuard>
      <div className="container mx-auto p-8">
        <h1 className="text-3xl font-bold mb-6">My Flashcard Collections</h1>
        {decks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg mb-4">No flashcard collections yet!</p>
            <Link href="/" className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors">
              Generate Your First Collection
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {decks.map((deck) => (
              <Link href={`/deck/${deck.id}`} key={deck.id}>
                <div className="bg-white p-6 rounded-lg shadow-md hover:shadow-lg transition-shadow cursor-pointer">
                  <div className="mb-4">
                    <h2 className="text-xl font-semibold text-gray-800 mb-2">{deck.title}</h2>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <span className={`px-2 py-1 rounded text-xs ${
                        deck.status === 'completed' ? 'bg-green-100 text-green-800' : 
                        deck.status === 'failed' ? 'bg-red-100 text-red-800' : 
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {deck.status || 'processing'}
                      </span>
                      {deck.source_type && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                          {deck.source_type === 'documents' ? '📄 Document' : '🎵 Audio'}
                        </span>
                      )}
                      {deck.model_used && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs">
                          {deck.model_used.includes('gemini') ? '✨ Gemini' : '🤖 AI'}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {deck.total_cards !== undefined && (
                    <div className="text-center">
                      <div className="bg-blue-50 p-3 rounded">
                        <div className="text-2xl font-bold text-blue-600">{deck.total_cards}</div>
                        <div className="text-sm text-gray-600">flashcards generated</div>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-4 flex justify-center">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      Click to preview & export
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}