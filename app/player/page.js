// Bare "/player" forwards straight to "today's session", the player's actual landing page.
import { redirect } from 'next/navigation';

export default function PlayerIndex() {
  redirect('/player/today');
}
