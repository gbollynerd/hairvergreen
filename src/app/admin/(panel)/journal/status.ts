export function postState(p: { status: string; published_at: string | null }) {
  if (p.status === 'published' && p.published_at && new Date(p.published_at) > new Date()) return { label: 'Scheduled', tone: 'blue' };
  return { draft: { label: 'Draft', tone: 'gray' }, review: { label: 'In review', tone: 'gold' }, scheduled: { label: 'Scheduled', tone: 'blue' }, published: { label: 'Published', tone: 'green' } }[p.status] ?? { label: p.status, tone: 'gray' };
}
