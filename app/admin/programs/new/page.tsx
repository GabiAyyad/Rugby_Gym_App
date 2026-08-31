import { requireAdminPage } from '@/lib/auth';
import { todayISO } from '@/lib/domain/week';
import { ProgramBuilder } from '@/components/admin/ProgramBuilder';

export const dynamic = 'force-dynamic';

export default async function NewProgramPage() {
  await requireAdminPage();

  // The default start date comes from the server so it cannot disagree with the
  // dates the rest of the app resolves against.
  return <ProgramBuilder program={null} today={todayISO()} />;
}
