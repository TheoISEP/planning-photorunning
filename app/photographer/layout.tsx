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

interface ManagedPhotographer {
  id: string;
  prenom: string;
  nom: string;
}

export default function PhotographerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [managedPhotographers, setManagedPhotographers] = useState<ManagedPhotographer[]>([]);
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
          router.push('/admin/planning');
          return;
        }
        setUser(data.user);

        // Récupérer les photographes gérés par ce référent
        await fetchManagedPhotographers(data.user.id);
      } catch (error) {
        router.push('/login');
      } finally {
        setLoading(false);
      }
    }

    async function fetchManagedPhotographers(userId: string) {
      try {
        // Récupérer le photographe actuel pour voir qui il gère
        const photographerRes = await fetch(`/api/photographers/${userId}`);
        if (!photographerRes.ok) return;

        const photographerData = await photographerRes.json();
        const photographer = photographerData.photographer;

        // Collecter les IDs des photographes à charge
        const chargeIds = [
          photographer.chargeOne,
          photographer.chargeTwo,
          photographer.chargeThree,
          photographer.chargeFour,
          photographer.chargeFive,
        ].filter(Boolean); // Retirer les valeurs vides

        if (chargeIds.length === 0) return;

        // Récupérer tous les photographes
        const allPhotographersRes = await fetch('/api/photographers');
        if (!allPhotographersRes.ok) return;

        const allPhotographersData = await allPhotographersRes.json();
        const allPhotographers = allPhotographersData.photographers;

        // Filtrer pour ne garder que ceux à charge
        const managed = allPhotographers
          .filter((p: any) => chargeIds.includes(p.id))
          .map((p: any) => ({
            id: p.id,
            prenom: p.prenom,
            nom: p.nom,
          }));

        setManagedPhotographers(managed);
      } catch (error) {
        console.error('Erreur lors de la récupération des photographes gérés:', error);
      }
    }

    fetchUser();
  }, [router]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600 mx-auto"></div>
          <p className="mt-4 text-sm text-muted-foreground">Chargement...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <>
      <PhotographerShell user={user} managedPhotographers={managedPhotographers}>{children}</PhotographerShell>
      <Toaster position="top-right" richColors />
    </>
  );
}
