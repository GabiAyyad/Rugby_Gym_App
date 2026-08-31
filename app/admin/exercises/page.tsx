import { ExercisesManager } from '@/components/admin/ExercisesManager';
import { listExercises } from '@/lib/actions/listExercises';
import { requireAdminPage } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Exercises' };

export default async function AdminExercisesPage() {
  const session = await requireAdminPage();
  const { exercises } = await listExercises(session);

  return <ExercisesManager initialExercises={exercises} />;
}
