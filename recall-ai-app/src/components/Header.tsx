'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

export default function Header() {
  const { user, loading } = useAuth();

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <header className="bg-white shadow-md">
      <nav className="container mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="text-xl font-semibold text-gray-700">
            <Link href="/" className="flex items-center gap-2">
              <span className="text-2xl">🧠</span>
              <span>FlashGen AI</span>
            </Link>
          </div>
          <div>
            {!loading && (
              <>
                {user ? (
                  <div className="flex items-center space-x-4">
                    <Link href="/decks">
                      <span className="text-gray-600 hover:text-blue-600">My Flashcards</span>
                    </Link>
                    <span className="text-gray-600">{user.email}</span>
                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700"
                    >
                      Logout
                    </button>
                  </div>
                ) : (
                  <Link href="/login">
                    <span className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">
                      Login
                    </span>
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </nav>
    </header>
  );
}