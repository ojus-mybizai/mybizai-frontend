import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-primary text-text-primary">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-6xl font-bold text-accent">404</h1>
        <h2 className="text-lg font-semibold">Page not found</h2>
        <p className="max-w-sm text-sm text-text-secondary">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/dashboard"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent/90"
        >
          Go to Dashboard
        </Link>
      </div>
    </div>
  );
}
