// Admin -> Programs -> [id]: the "edit a block" screen. Loads the full
// program (days + exercises) server-side and hands it to <ProgramBuilder>,
// the same component the "new block" page uses.
import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/auth';
import { ActionError } from '@/lib/http';
import { getProgram } from '@/lib/actions/getProgram';
import { todayISO } from '@/lib/domain/week';
import { ProgramBuilder } from '@/components/admin/ProgramBuilder';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * getProgram scopes its lookup to the session's team, so an id belonging to the
 * other squad arrives here as a 404 rather than as their programming.
 */
async function loadProgram(session, id) {
  // A malformed id would come back from Postgres as a 22P02, not a miss.
  if (!UUID.test(id)) notFound();
  try {
    return await getProgram(session, id);
  } catch (error) {
    // Any other kind of thrown error (a real server/DB problem) should still
    // bubble up to the error boundary rather than being swallowed as a 404.
    if (error instanceof ActionError && error.status === 404) notFound();
    throw error;
  }
}

export default async function EditProgramPage({ params }) {
  const session = await requireAdminPage();
  const { id } = await params;
  const program = await loadProgram(session, id);

  return <ProgramBuilder program={program} today={todayISO()} />;
}
