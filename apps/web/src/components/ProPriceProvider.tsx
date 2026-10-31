'use client'

import { createContext, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { proPriceVars } from '@vesta/shared/utils/pro-price-format'
import type { CustomerProPrice } from '@/app/queries/pro-price-queries'

const ProPriceContext = createContext<CustomerProPrice | null>(null)

/** Holds the Pro price in effect today for every customer screen under it. */
export function ProPriceProvider({ price, children }: { price: CustomerProPrice | null; children: React.ReactNode }) {
  return <ProPriceContext.Provider value={price}>{children}</ProPriceContext.Provider>
}

/** The Pro price as text pieces (`price`, `amount`, `period`) in the current language, or null if none is set. */
export function useProPriceVars(override?: CustomerProPrice | null) {
  const context = useContext(ProPriceContext)
  const { i18n } = useTranslation()
  const price = override === undefined ? context : override
  return price ? proPriceVars(price, i18n.language) : null
}
