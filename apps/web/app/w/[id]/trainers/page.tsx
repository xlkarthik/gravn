import { redirect } from 'next/navigation';

export default async function TrainersRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/w/${id}?tab=more`);
}
