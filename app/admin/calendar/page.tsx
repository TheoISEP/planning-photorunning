import { PhotographerBoard } from '@/app/photographer/planning/_components/PhotographerBoard';

// « Mon calendrier » de l'admin : ses propres disponibilités, comme un photographe.
export default function AdminOwnCalendarPage() {
  return <PhotographerBoard mode="active" linkBase="/admin/planning" statsHref="/admin/calendar/stats" />;
}
