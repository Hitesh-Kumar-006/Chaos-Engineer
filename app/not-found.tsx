import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-gray-900 text-white p-4">
      <h2 className="text-3xl font-bold mb-2">404 - System Not Found</h2>
      <p className="text-gray-400 mb-6">The routing engine lost connection to this path.</p>
      <Link href="/" className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded transition-colors">
        Return to Dashboard
      </Link>
    </div>
  );
}
