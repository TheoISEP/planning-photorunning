'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { fetchJson, type CourseJson } from '@/components/planning/types';
import { CourseForm, payloadFromValues } from '../../_components/CourseForm';

export default function EditCoursePage() {
  const router = useRouter();
  const params = useParams();
  const courseId = params.id as string;
  const [course, setCourse] = useState<CourseJson | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchJson<{ course: CourseJson }>(`/api/courses/${courseId}`)
      .then((r) => { if (!cancelled) setCourse(r.course); })
      .catch((e: unknown) => { if (!cancelled) setError(e instanceof Error ? e.message : 'Course introuvable'); });
    return () => { cancelled = true; };
  }, [courseId]);

  if (error) {
    return <div className="p-6 text-sm text-rose-600">{error}</div>;
  }
  if (!course) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-gray-600" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mb-6 flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href={`/admin/planning/${courseId}`}><ArrowLeft className="mr-2 h-4 w-4" /> Retour</Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Modifier la course</h1>
          <p className="mt-1 text-sm text-muted-foreground">{course.nom}</p>
        </div>
      </div>
      <div className="max-w-4xl">
        <CourseForm
          course={course}
          submitLabel="Enregistrer les modifications"
          onCancel={() => router.push(`/admin/planning/${courseId}`)}
          onSubmit={async (values) => {
            try {
              const res = await fetchJson<{ course: CourseJson; added?: number; deleted?: number; reopened?: boolean }>(`/api/courses/${courseId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payloadFromValues(values)),
              });
              if (res.reopened) {
                toast.success('Course enregistrée et repassée « En cours » : le nouveau créneau est en attente pour tout le monde.');
              } else if (res.added) {
                toast.success(`Course enregistrée, ${res.added} créneau${res.added > 1 ? 'x' : ''} ajouté${res.added > 1 ? 's' : ''}.`);
              } else {
                toast.success('Course enregistrée');
              }
              router.push(`/admin/planning/${courseId}`);
            } catch (error) {
              toast.error(error instanceof Error ? error.message : 'Erreur lors de la mise à jour');
            }
          }}
        />
      </div>
    </div>
  );
}
