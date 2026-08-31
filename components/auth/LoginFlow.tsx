'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import type { LookupTeamResult, RosterEntry } from '@/lib/actions/lookupTeam';
import { Badge, Button, ErrorNote, Input } from '@/components/shared';

type Step = 'code' | 'roster' | 'pin' | 'setup';

export function LoginFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('code');
  const [loginCode, setLoginCode] = useState('');
  const [team, setTeam] = useState<LookupTeamResult | null>(null);
  const [selected, setSelected] = useState<RosterEntry | null>(null);
  const [pin, setPin] = useState('');
  const [setupName, setSetupName] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submitCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.post<LookupTeamResult>('/api/auth/team', { loginCode });
      setTeam(result);
      setStep(result.needsAdminSetup && result.roster.length === 0 ? 'setup' : 'roster');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  async function signIn(player: RosterEntry, enteredPin?: string) {
    setBusy(true);
    setError(null);
    try {
      const { redirectTo } = await api.post<{ redirectTo: string }>('/api/auth/login', {
        loginCode,
        playerId: player.id,
        pin: enteredPin ?? null,
      });
      router.replace(redirectTo);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not sign in.');
      setBusy(false);
    }
  }

  async function submitSetup(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { redirectTo } = await api.post<{ redirectTo: string }>('/api/auth/bootstrap', {
        loginCode,
        name: setupName,
        pin: setupPin,
      });
      router.replace(redirectTo);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not create the admin account.');
      setBusy(false);
    }
  }

  function choose(player: RosterEntry) {
    setSelected(player);
    setError(null);
    if (player.isAdmin) {
      setPin('');
      setStep('pin');
    } else {
      void signIn(player);
    }
  }

  const players = team?.roster.filter((entry) => entry.isPlayer && !entry.isAdmin) ?? [];
  const admins = team?.roster.filter((entry) => entry.isAdmin) ?? [];

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 grid size-14 place-items-center rounded-2xl bg-pitch-500 text-2xl">
          🏉
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Rugby Strength</h1>
        <p className="mt-1 text-sm text-ink-400">
          {step === 'code' ? 'Enter your team code to get started' : team?.teamName}
        </p>
      </div>

      <ErrorNote message={error} />

      {step === 'code' && (
        <form onSubmit={submitCode} className="mt-4 flex flex-col gap-4">
          <Input
            label="Team code"
            value={loginCode}
            onChange={(event) => setLoginCode(event.target.value.toUpperCase())}
            placeholder="PAL2026"
            autoCapitalize="characters"
            autoComplete="off"
            autoFocus
            required
          />
          <Button type="submit" size="lg" fullWidth loading={busy}>
            Continue
          </Button>
        </form>
      )}

      {step === 'roster' && team && (
        <div className="mt-4 flex flex-col gap-6">
          {players.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-ink-400 uppercase">Players</h2>
              <ul className="flex flex-col gap-2">
                {players.map((player) => (
                  <li key={player.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => choose(player)}
                      className="flex w-full items-center justify-between rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 text-left transition-colors hover:border-pitch-500 hover:bg-ink-850 disabled:opacity-50"
                    >
                      <span className="font-medium">{player.name}</span>
                      {player.positionGroup && (
                        <Badge tone={player.positionGroup === 'forward' ? 'info' : 'warn'}>
                          {player.positionGroup === 'forward' ? 'Forward' : 'Back'}
                        </Badge>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {admins.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-ink-400 uppercase">
                Coaches and admins
              </h2>
              <ul className="flex flex-col gap-2">
                {admins.map((admin) => (
                  <li key={admin.id}>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => choose(admin)}
                      className="flex w-full items-center justify-between rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 text-left transition-colors hover:border-flare-500 hover:bg-ink-850 disabled:opacity-50"
                    >
                      <span className="font-medium">{admin.name}</span>
                      <span className="text-xs text-ink-400">PIN required</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {players.length === 0 && admins.length === 0 && (
            <p className="rounded-xl border border-dashed border-ink-700 px-4 py-6 text-center text-sm text-ink-400">
              Nobody has been added to this team yet.
            </p>
          )}

          {team.needsAdminSetup && (
            <Button variant="secondary" fullWidth onClick={() => setStep('setup')}>
              Set up the first admin account
            </Button>
          )}

          <Button variant="ghost" fullWidth onClick={() => setStep('code')}>
            Wrong team? Change code
          </Button>
        </div>
      )}

      {step === 'pin' && selected && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void signIn(selected, pin);
          }}
          className="mt-4 flex flex-col gap-4"
        >
          <p className="text-sm text-ink-300">
            Signing in as <span className="font-semibold text-ink-50">{selected.name}</span>
          </p>
          <Input
            label="Admin PIN"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(event) => setPin(event.target.value.replace(/\D/g, ''))}
            autoFocus
            required
          />
          <Button type="submit" size="lg" fullWidth loading={busy}>
            Sign in
          </Button>
          <Button type="button" variant="ghost" fullWidth onClick={() => setStep('roster')}>
            Back
          </Button>
        </form>
      )}

      {step === 'setup' && (
        <form onSubmit={submitSetup} className="mt-4 flex flex-col gap-4">
          <p className="rounded-xl border border-ink-700 bg-ink-900 px-3 py-2 text-sm text-ink-300">
            This team has no admin yet. Create the first one - after that, admins are added from the
            Players screen.
          </p>
          <Input
            label="Your name"
            value={setupName}
            onChange={(event) => setSetupName(event.target.value)}
            autoFocus
            required
          />
          <Input
            label="Choose an admin PIN"
            type="password"
            inputMode="numeric"
            hint="4-8 digits. You will need this every time you sign in."
            value={setupPin}
            onChange={(event) => setSetupPin(event.target.value.replace(/\D/g, ''))}
            required
          />
          <Button type="submit" size="lg" fullWidth loading={busy}>
            Create admin account
          </Button>
          <Button type="button" variant="ghost" fullWidth onClick={() => setStep(team ? 'roster' : 'code')}>
            Back
          </Button>
        </form>
      )}
    </div>
  );
}
