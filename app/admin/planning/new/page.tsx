'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { fetchJson, type CourseJson } from '@/components/planning/types';
import { CourseForm, payloadFromValues } from '../_components/CourseForm';

export default function NewCoursePage() {
  const router = useRouter();

  return (
    <div className="h-full overflow-auto">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/planning"><ArrowLeft className="mr-2 h-4 w-4" /> Retour</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nouvelle course</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tous les photographes actifs seront mis « en attente » sur chaque créneau.</p>
        </div>
      </div>
      <div className="max-w-4xl">
        <CourseForm
          submitLabel="Créer la course"
          onCancel={() => router.push('/admin/planning')}
          onSubmit={async (values) => {
            try {
              const res = await fetchJson<{ course: CourseJson }>('/api/courses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadFromValues(values)),
              });
              toast.success(`Course « ${res.course.nom} » créée`);
              router.push('/admin/planning');
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Erreur lors de la création');
            }
          }}
        />
      </div>
    </div>
  );
}
