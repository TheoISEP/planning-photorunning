'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PhotographerShell } from './_components/PhotographerShell';
import { Toaster } from 'sonner';

interface User {
  id: string;
  email: string;
  role: string;
  nom: string;
  prenom?: string;
}

export default function PhotographerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchUser() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/login');
          return;
        }
        const data = await res.json();
        if (data.user.role !== 'photographer') {
          router.push('/admin/calendrier');
          return;
        }
        setUser(data.user);
      } catch (error) {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-green-600 mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <PhotographerShell user={user}>{children}</PhotographerShell>
      <Toaster position="top-right" richColors />
    </>
  );
}
