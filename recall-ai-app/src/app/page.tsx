import UploadTabs from "@/components/UploadTabs";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4 sm:p-8">
      <div className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900">
          AI-Powered Flashcard Generator
        </h1>
        <p className="mt-4 text-lg sm:text-xl text-gray-600">
          Upload your notes or audio, generate flashcards with AI, and export for Anki, Quizlet, or any platform.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            Document & Audio Upload
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            AI-Generated Flashcards
          </span>
          <span className="flex items-center gap-2">
            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
            Export to Any Platform
          </span>
        </div>
      </div>
      <UploadTabs />
    </main>
  );
}
