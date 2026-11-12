import { getProPrice } from '@/app/queries/pro-price-queries';
import { ProPriceProvider } from '@/components/ProPriceProvider';

// The login notice quotes the admin-set Pro price (ADR 0011).
export default async function LoginLayout({ children }: { children: React.ReactNode }) {
  return <ProPriceProvider price={await getProPrice()}>{children}</ProPriceProvider>;
}
