import { notFound } from "next/navigation"
import CryptoPage from "@/components/dashboard/crypto-page"
import { VALID_CRYPTO_FILTERS } from "@/lib/crypto-nav"

export default async function Page({ params }: { params: Promise<{ filter: string }> }) {
  const { filter } = await params
  if (!VALID_CRYPTO_FILTERS.has(filter)) notFound()
  return <CryptoPage filter={filter} />
}
