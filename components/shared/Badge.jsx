// Badge.jsx — a small rounded label used throughout the app to show status
// (e.g. "Active", "Behind", "Admin", a position group). Every badge in the
// app should render through this component so the five colour "tones" stay
// consistent instead of being redefined ad hoc in every screen.
import { cn } from './cn';

// Maps a semantic tone name to the CSS class that colours it (see
// styles/components.css for the actual colours behind each class).
const TONE_CLASS = {
  neutral: 'badge-neutral', // grey — default, no particular meaning
  good: 'badge-good', // green — positive status (e.g. "Complete", "Admin")
  warn: 'badge-warn', // amber — needs attention but not urgent
  bad: 'badge-bad', // red — a problem (e.g. "Not started", "No PIN")
  info: 'badge-info', // blue — neutral-but-notable info (e.g. "Forward")
};

/**
 * @param {object} props
 * @param {'neutral'|'good'|'warn'|'bad'|'info'} [props.tone] Which colour to use.
 * @param {string} [props.className] Extra classes merged onto the badge.
 * @param {import('react').ReactNode} props.children The badge's text/content.
 */
export function Badge({ tone = 'neutral', className, children }) {
  return <span className={cn('badge', TONE_CLASS[tone], className)}>{children}</span>;
}
