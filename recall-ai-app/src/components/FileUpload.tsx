'use client';

import { useState } from 'react';
import { storage } from '@/lib/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { useAuth } from '@/hooks/useAuth';

interface FileUploadProps {
  onUploadComplete?: (downloadURL: string, filename: string) => void;
  onUploadError?: (error: string) => void;
}

export default function FileUpload({ onUploadComplete, onUploadError }: FileUploadProps = {}) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleUpload = () => {
    if (!file) {
      setError('Please select a file first!');
      return;
    }

    if (!user) {
      setError('You must be logged in to upload files!');
      return;
    }

    setUploading(true);
    setError(null);
    const storageRef = ref(storage, `uploads/documents/${user.uid}/${file.name}`);
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
        console.error("Upload error:", error);
        setUploading(false);
        onUploadError?.(errorMessage);
      },
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          console.log('Document file available at', downloadURL);
          setUploading(false);
          setFile(null);
          alert('Document uploaded successfully! Processing will begin shortly.');
          onUploadComplete?.(downloadURL, file.name);
        });
      }
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-8 space-y-6">
      <div className="flex items-center justify-center w-full">
        <label htmlFor="dropzone-file" className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
              <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
            </svg>
            <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
            <p className="text-xs text-gray-500">PDF or TXT files</p>
          </div>
          <input id="dropzone-file" type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.txt" />
        </label>
      </div>
      
      {uploading && (
        <div className="w-full bg-gray-200 rounded-full h-2.5">
          <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
        </div>
      )}
      
      {error && <p className="text-sm text-red-600 text-center">{error}</p>}
      
      {file && !uploading && (
        <div className="text-center">
          <p className="text-sm text-gray-600">Selected file: {file.name}</p>
        </div>
      )}
      
      <button
        onClick={handleUpload}
        className="w-full px-4 py-2 text-lg font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
        disabled={!file || uploading}
      >
        {uploading ? `Uploading... ${Math.round(progress)}%` : 'Generate Flashcards from Document'}
      </button>
    </div>
  );
}