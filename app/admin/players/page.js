// Admin -> Players: the squad roster with add/edit/delete. Fetches the
// roster once on the server (listPlayers), then hands it to the interactive
// <PlayersManager> client component, which owns all further add/edit/delete.
import { PlayersManager } from '@/components/admin/PlayersManager';
import { listPlayers } from '@/lib/actions/listPlayers';
import { requireAdminPage } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Players' };

export default async function AdminPlayersPage() {
  const session = await requireAdminPage();
  const { players } = await listPlayers(session);

  return <PlayersManager initialPlayers={players} teamName={session.teamName} currentPlayerId={session.playerId} />;
}
