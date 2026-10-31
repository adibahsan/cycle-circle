import { getProPrice } from '@/app/queries/pro-price-queries'
import { TermsClient } from './TermsClient'

export default async function TermsPage() {
  return <TermsClient price={await getProPrice()} />
}
