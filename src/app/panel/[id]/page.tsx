import ServerPanel from "@/components/server-panel";

export default async function ServerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ServerPanel serverId={id} />;
}
