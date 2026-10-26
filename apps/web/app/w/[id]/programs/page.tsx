import { redirect } from 'next/navigation';

export default async function ProgramsRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/w/${id}?tab=programs`);
}
