import { redirect } from 'next/navigation';

export default async function ActivityRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/w/${id}?tab=activity`);
}
