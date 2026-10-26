import { redirect } from 'next/navigation';

export default async function MembersRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ client?: string }>;
}) {
  const { id } = await params;
  const { client } = await searchParams;
  redirect(client ? `/w/${id}?tab=members&client=${client}` : `/w/${id}?tab=members`);
}
