import EventDetailPm from "@/components/markets/event-detail-pm"

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return <EventDetailPm slug={slug} />
}
