import 'server-only';
import { db } from '@/lib/supabase/client';
import type { PlayerRow, TeamRow } from '@/types/database';
import { unwrap, unwrapMaybe } from './index';

export async function findTeamByLoginCode(code: string): Promise<TeamRow | null> {
  return unwrapMaybe(
    await db().from('teams').select('*').ilike('login_code', code.trim()).maybeSingle(),
    'findTeamByLoginCode',
  );
}

export async function listTeamRoster(teamId: string): Promise<PlayerRow[]> {
  return unwrap(
    await db().from('players').select('*').eq('team_id', teamId).order('name'),
    'listTeamRoster',
  );
}

export async function findPlayerInTeam(teamId: string, playerId: string): Promise<PlayerRow | null> {
  return unwrapMaybe(
    await db().from('players').select('*').eq('team_id', teamId).eq('id', playerId).maybeSingle(),
    'findPlayerInTeam',
  );
}

export async function countTeamAdmins(teamId: string): Promise<number> {
  const { count, error } = await db()
    .from('players')
    .select('id', { count: 'exact', head: true })
    .eq('team_id', teamId)
    .eq('is_admin', true);
  if (error) throw new Error(`countTeamAdmins: ${error.message}`);
  return count ?? 0;
}

export async function insertAdminPlayer(input: {
  teamId: string;
  name: string;
  pinHash: string;
}): Promise<PlayerRow> {
  return unwrap(
    await db()
      .from('players')
      .insert({
        team_id: input.teamId,
        name: input.name,
        is_admin: true,
        is_player: false,
        position_group: null,
        admin_pin_hash: input.pinHash,
      })
      .select('*')
      .single(),
    'insertAdminPlayer',
  );
}
