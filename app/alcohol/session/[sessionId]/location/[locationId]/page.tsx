import LocationCountClient from "./LocationCountClient";

export default async function LocationCountPage({
  params,
}: {
  params: Promise<{ sessionId: string; locationId: string }>;
}) {
  const { sessionId, locationId } = await params;
  return <LocationCountClient sessionId={sessionId} locationId={locationId} />;
}