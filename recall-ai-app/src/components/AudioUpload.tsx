'use client';

import { useState, useRef } from 'react';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/hooks/useAuth';

interface AudioUploadProps {
  onUploadComplete?: (downloadURL: string, filename: string) => void;
  onUploadError?: (error: string) => void;
}

export default function AudioUpload({ onUploadComplete, onUploadError }: AudioUploadProps) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [audioInfo, setAudioInfo] = useState<{duration: string; size: string} | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  // const audioRef = useRef<HTMLAudioElement>(null);

  const allowedTypes = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/flac', 'audio/aac', 'audio/ogg', 'audio/mpeg'];
  const maxSizeBytes = 50 * 1024 * 1024; // 50MB

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const validateFile = (file: File): string | null => {
    if (!allowedTypes.includes(file.type)) {
      return `Unsupported file type. Please use: MP3, WAV, M4A, FLAC, AAC, or OGG`;
    }
    
    if (file.size > maxSizeBytes) {
      return `File too large. Maximum size is ${formatFileSize(maxSizeBytes)}`;
    }
    
    return null;
  };

  const getAudioInfo = (file: File): Promise<{duration: string; size: string}> => {
    return new Promise((resolve) => {
      const audio = new Audio();
      const url = URL.createObjectURL(file);
      
      audio.onloadedmetadata = () => {
        const duration = formatDuration(audio.duration);
        const size = formatFileSize(file.size);
        URL.revokeObjectURL(url);
        resolve({ duration, size });
      };
      
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ duration: 'Unknown', size: formatFileSize(file.size) });
      };
      
      audio.src = url;
    });
  };

  const handleFileSelect = async (selectedFile: File) => {
    const validationError = validateFile(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setFile(selectedFile);
    setError(null);
    
    // Get audio information
    try {
      const info = await getAudioInfo(selectedFile);
      setAudioInfo(info);
    } catch (err) {
      console.error('Error getting audio info:', err);
      setAudioInfo({ duration: 'Unknown', size: formatFileSize(selectedFile.size) });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleUpload = () => {
    if (!file || !user) {
      setError(!user ? 'You must be logged in to upload files!' : 'Please select a file first!');
      return;
    }

    setUploading(true);
    setError(null);
    
    // Upload to audio-specific path
    const storageRef = ref(storage, `uploads/audio/${user.uid}/${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        setProgress(progress);
      },
      (error) => {
        const errorMessage = 'Upload failed. Please try again.';
        setError(errorMessage);
        setUploading(false);
        onUploadError?.(errorMessage);
        console.error("Upload error:", error);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          console.log('Audio file available at', downloadURL);
          setUploading(false);
          setFile(null);
          setAudioInfo(null);
          setProgress(0);
          
          onUploadComplete?.(downloadURL, file.name);
          
          // Reset file input
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
        });
      }
    );
  };

  const handleRemoveFile = () => {
    setFile(null);
    setAudioInfo(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full max-w-lg p-8 space-y-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center text-gray-800">
        Upload Audio Lecture
      </h2>
      
      <div
        className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
          dragActive 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <svg className="w-8 h-8 mb-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4a4 4 0 016.6 3.1A4 4 0 0117 12v1a1 1 0 01-1 1H8a1 1 0 01-1-1v-1a4 4 0 014-4V7a2 2 0 114 0v5a1 1 0 102 0V7a4 4 0 00-8 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16v4a1 1 0 001 1h8a1 1 0 001-1v-4" />
          </svg>
          <p className="mb-2 text-sm text-gray-500">
            <span className="font-semibold">Click to upload</span> or drag and drop
          </p>
          <p className="text-xs text-gray-500">
            MP3, WAV, M4A, FLAC, AAC, OGG (Max 50MB)
          </p>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={handleFileChange}
          accept=".mp3,.wav,.m4a,.flac,.aac,.ogg"
        />
      </div>

      {/* File Info Display */}
      {file && audioInfo && (
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h3 className="font-medium text-gray-800 truncate">{file.name}</h3>
              <div className="text-sm text-gray-600 mt-1">
                <span>Duration: {audioInfo.duration}</span>
                <span className="mx-2">•</span>
                <span>Size: {audioInfo.size}</span>
              </div>
            </div>
            <button
              onClick={handleRemoveFile}
              className="ml-2 text-red-500 hover:text-red-700"
              type="button"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {uploading && (
        <div className="space-y-2">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 text-center">
            Uploading audio... {Math.round(progress)}%
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Upload Button */}
      <button
        onClick={handleUpload}
        className="w-full px-4 py-3 text-lg font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
        disabled={!file || uploading}
      >
        {uploading ? (
          `Processing Audio... ${Math.round(progress)}%`
        ) : (
          '🎵 Generate Flashcards from Audio'
        )}
      </button>
      
      <div className="text-center text-xs text-gray-500">
        <p>Audio will be transcribed and converted into study flashcards</p>
        <p className="mt-1">Supported: Lectures, podcasts, meetings, voice notes</p>
      </div>
    </div>
  );
}