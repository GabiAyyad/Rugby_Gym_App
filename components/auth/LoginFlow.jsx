'use client';

// LoginFlow.jsx — the whole sign-in experience for /login, rendered as a
// small step machine (no routing involved; each "step" is just a different
// chunk of JSX shown for the same component). There is no email/password:
//
//   code   -> enter the team's login code (e.g. "PAL2026")
//   roster -> pick your name from that team's player/admin list
//   pin    -> (admins only) enter the 4-8 digit PIN before signing in
//   setup  -> (first run only) create the team's very first admin account
//
// `step` below is the state variable that decides which of the four blocks of
// JSX at the bottom of this file is currently shown.
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Badge, Button, ErrorNote, Input } from '@/components/shared';

export function LoginFlow() {
  const router = useRouter();
  const [step, setStep] = useState('code'); // 'code' | 'roster' | 'pin' | 'setup'
  const [loginCode, setLoginCode] = useState('');
  const [team, setTeam] = useState(null);
  const [selected, setSelected] = useState(null);
  const [pin, setPin] = useState('');
  const [setupName, setSetupName] = useState('');
  const [setupPin, setSetupPin] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  /** Step 1 (code): exchanges the team code for that team's roster, then
   *  moves on — straight to first-admin setup if the team has literally no
   *  players/admins yet, otherwise to the roster picker. */
  async function submitCode(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await api.post('/api/auth/team', { loginCode });
      setTeam(result);
      setStep(result.needsAdminSetup && result.roster.length === 0 ? 'setup' : 'roster');
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not reach the server.');
    } finally {
      setBusy(false);
    }
  }

  /** Final step of both the roster and pin flows: asks the server to create
   *  the session cookie, then follows whatever `redirectTo` it returns
   *  (the player's or admin's landing page). `enteredPin` is only passed for
   *  admins — see the `choose` gate below. */
  async function signIn(player, enteredPin) {
    setBusy(true);
    setError(null);
    try {
      const { redirectTo } = await api.post('/api/auth/login', {
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

  /** Step (setup): creates the team's first admin account and signs them in
   *  immediately — this path is only ever reachable once, before any admin exists. */
  async function submitSetup(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { redirectTo } = await api.post('/api/auth/bootstrap', {
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

  /** Handles tapping a name on the roster. A plain player signs straight in;
   *  an admin is routed to the PIN step first — the roster alone is never
   *  enough to reach an admin account. */
  function choose(player) {
    setSelected(player);
    setError(null);
    if (player.isAdmin) {
      setPin('');
      setStep('pin');
    } else {
      void signIn(player);
    }
  }

  // Split the roster into two sections for display: plain players (train
  // only) and admins/coaches (who need a PIN to sign in). A player-admin
  // (isPlayer && isAdmin) shows up in the admins section, since choosing them
  // always requires the PIN step.
  const players = team?.roster.filter((entry) => entry.isPlayer && !entry.isAdmin) ?? [];
  const admins = team?.roster.filter((entry) => entry.isAdmin) ?? [];

  return (
    <div className="w-full" style={{ maxWidth: '24rem' }}>
      <div className="mb-4 text-center">
        <div className="mb-3 text-2xl" style={{ display: 'grid', placeItems: 'center', width: '3.5rem', height: '3.5rem', borderRadius: '1rem', background: 'var(--pitch-500)', margin: '0 auto' }}>
          🏉
        </div>
        <h1 className="text-2xl font-bold">Rugby Strength</h1>
        <p className="mt-1 text-sm text-ink-400">{step === 'code' ? 'Enter your team code to get started' : team?.teamName}</p>
      </div>

      <ErrorNote message={error} />

      {/* Step: code — the only thing shown on first load. */}
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

      {/* Step: roster — two sections (players, then admins/coaches); tapping
          a name either signs in immediately or moves to the pin step. */}
      {step === 'roster' && team && (
        <div className="mt-4 flex flex-col gap-6">
          {players.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-ink-400 uppercase">Players</h2>
              <ul className="flex flex-col gap-2" style={{ listStyle: 'none', padding: 0 }}>
                {players.map((player) => (
                  <li key={player.id}>
                    <button type="button" disabled={busy} onClick={() => choose(player)} className="picker-row">
                      <span className="font-medium">{player.name}</span>
                      {player.positionGroup && <Badge tone={player.positionGroup === 'forward' ? 'info' : 'warn'}>{player.positionGroup === 'forward' ? 'Forward' : 'Back'}</Badge>}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {admins.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold tracking-wide text-ink-400 uppercase">Coaches and admins</h2>
              <ul className="flex flex-col gap-2" style={{ listStyle: 'none', padding: 0 }}>
                {admins.map((admin) => (
                  <li key={admin.id}>
                    <button type="button" disabled={busy} onClick={() => choose(admin)} className="picker-row">
                      <span className="font-medium">{admin.name}</span>
                      <span className="text-xs text-ink-400">PIN required</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {players.length === 0 && admins.length === 0 && (
            <p className="text-sm text-ink-400 text-center" style={{ border: '1px dashed var(--ink-700)', borderRadius: '0.75rem', padding: '1.5rem 1rem' }}>
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

      {/* Step: pin — shown only after choosing an admin's name in the roster step. */}
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

      {/* Step: setup — only reachable when the team code resolves to a team
          with zero players and zero admins (a brand-new deployment). */}
      {step === 'setup' && (
        <form onSubmit={submitSetup} className="mt-4 flex flex-col gap-4">
          <p className="text-sm text-ink-300" style={{ border: '1px solid var(--ink-700)', background: 'var(--ink-900)', borderRadius: '0.75rem', padding: '0.5rem 0.75rem' }}>
            This team has no admin yet. Create the first one - after that, admins are added from the Players screen.
          </p>
          <Input label="Your name" value={setupName} onChange={(event) => setSetupName(event.target.value)} autoFocus required />
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
