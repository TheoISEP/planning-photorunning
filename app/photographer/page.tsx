'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PhotographerPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/photographer/planning');
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600 mx-auto"></div>
        <p className="mt-4 text-sm text-muted-foreground">Redirection...</p>
      </div>
    </div>
  );
}
