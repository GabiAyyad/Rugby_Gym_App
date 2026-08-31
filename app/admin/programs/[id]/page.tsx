import { notFound } from 'next/navigation';
import { requireAdminPage } from '@/lib/auth';
import { ActionError } from '@/lib/http';
import { getProgram } from '@/lib/actions/getProgram';
import { todayISO } from '@/lib/domain/week';
import { ProgramBuilder } from '@/components/admin/ProgramBuilder';
import type { SessionUser } from '@/types/common';
import type { Program } from '@/types/program';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * getProgram scopes its lookup to the session's team, so an id belonging to the
 * other squad arrives here as a 404 rather than as their programming.
 */
async function loadProgram(session: SessionUser, id: string): Promise<Program> {
  // A malformed id would come back from Postgres as a 22P02, not a miss.
  if (!UUID.test(id)) notFound();
  try {
    return await getProgram(session, id);
  } catch (error) {
    if (error instanceof ActionError && error.status === 404) notFound();
    throw error;
  }
}

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminPage();
  const { id } = await params;
  const program = await loadProgram(session, id);

  return <ProgramBuilder program={program} today={todayISO()} />;
}
