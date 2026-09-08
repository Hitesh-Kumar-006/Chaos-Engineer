'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-gray-900 text-white p-4">
      <h2 className="text-2xl font-bold text-red-500 mb-4">A critical error occurred.</h2>
      <p className="font-mono text-sm bg-black p-4 rounded mb-6 text-red-400">
        {error.message || "Unknown execution failure."}
      </p>
      <button
        onClick={() => reset()}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
