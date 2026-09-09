// Admin -> Programs: the list of training blocks for this team, grouped
// into live/upcoming/shelved/finished by <ProgramList>. Links from here lead
// to /admin/programs/new (create) or /admin/programs/[id] (edit).
import { requireAdminPage } from '@/lib/auth';
import { listPrograms } from '@/lib/actions/listPrograms';
import { todayISO } from '@/lib/domain/week';
import { ProgramList } from '@/components/admin/ProgramList';

export const dynamic = 'force-dynamic';

export default async function ProgramsPage() {
  const session = await requireAdminPage();
  const { programs } = await listPrograms(session);

  // Today is resolved on the server so the buckets agree with the isActive flag
  // the action derived, whatever the coach's device clock says.
  return <ProgramList programs={programs} today={todayISO()} />;
}
