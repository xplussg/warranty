export type WarrantyRecord = {
  productCode: string
  purchaseDate: string
  expiryDate: string
  name: string
  email: string
}

const store: Record<string, WarrantyRecord> = {}

export function registerWarranty(data: WarrantyRecord) {
  store[data.productCode] = data
  return store[data.productCode]
}

export function lookupWarranty(productCode: string) {
  return store[productCode] ?? null
}
