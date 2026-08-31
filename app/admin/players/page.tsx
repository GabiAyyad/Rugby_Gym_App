import { PlayersManager } from '@/components/admin/PlayersManager';
import { listPlayers } from '@/lib/actions/listPlayers';
import { requireAdminPage } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Players' };

export default async function AdminPlayersPage() {
  const session = await requireAdminPage();
  const { players } = await listPlayers(session);

  return (
    <PlayersManager
      initialPlayers={players}
      teamName={session.teamName}
      currentPlayerId={session.playerId}
    />
  );
}
