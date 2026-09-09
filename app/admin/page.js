// Bare "/admin" has nothing of its own to show — it just forwards to the
// dashboard, which is the actual admin landing page.
import { redirect } from 'next/navigation';

export default function AdminIndex() {
  redirect('/admin/dashboard');
}
