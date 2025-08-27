'use client';

import { useState } from 'react';
import FileUpload from './FileUpload';
import AudioUpload from './AudioUpload';

export default function UploadTabs() {
  const [activeTab, setActiveTab] = useState<'documents' | 'audio'>('documents');

  const handleUploadComplete = (downloadURL: string, filename: string) => {
    console.log('Upload complete:', downloadURL, filename);
    // The upload components handle success already, just logging here
  };

  const handleUploadError = (error: string) => {
    console.error('Upload error:', error);
    // The upload components handle errors already, just logging here
  };

  return (
    <div className="w-full max-w-2xl">
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 mb-6">
        <button
          onClick={() => setActiveTab('documents')}
          className={`flex-1 py-3 px-4 text-center font-medium text-sm transition-colors ${
            activeTab === 'documents'
              ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <span>📄</span>
            <span>Documents</span>
          </div>
          <div className="text-xs mt-1 text-gray-500">
            PDF, TXT files
          </div>
        </button>
        <button
          onClick={() => setActiveTab('audio')}
          className={`flex-1 py-3 px-4 text-center font-medium text-sm transition-colors ${
            activeTab === 'audio'
              ? 'border-b-2 border-blue-500 text-blue-600 bg-blue-50'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <span>🎵</span>
            <span>Audio</span>
          </div>
          <div className="text-xs mt-1 text-gray-500">
            MP3, WAV, M4A, etc.
          </div>
        </button>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'documents' ? (
          <FileUpload 
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
          />
        ) : (
          <AudioUpload 
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
          />
        )}
      </div>

      {/* Usage Instructions */}
      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-medium text-gray-900 mb-2">How it works:</h3>
        <ol className="text-sm text-gray-600 space-y-1">
          <li>1. Upload your study material (documents or audio)</li>
          <li>2. AI processes and generates flashcards automatically</li>
          <li>3. View your generated flashcards in &ldquo;My Decks&rdquo;</li>
          <li>4. Export flashcards for use in Anki, Quizlet, or other platforms</li>
        </ol>
      </div>
    </div>
  );
}