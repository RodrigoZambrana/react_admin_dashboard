/* eslint-disable  @typescript-eslint/no-explicit-any */
export function toUnixSeconds(date: any): number {
  try {
    const d = date ? new Date(date) : new Date()
    return Math.floor(d.getTime() / 1000)
  } catch {
    return Math.floor(Date.now() / 1000)
  }
}

export function toAddressLines(o: any, prefix: 'shipping' | 'billing') {
  if (!o) return { line1: '', line2: '', line3: '', line4: '' }
  const l1 = o[`${prefix}Address1`] || ''
  const l2 = o[`${prefix}Address2`] || ''
  const city = o[`${prefix}City`] || ''
  const state = o[`${prefix}State`] || ''
  const zip = o[`${prefix}Zip`] || ''
  const l3 = [city, state, zip].filter(Boolean).join(', ')
  return { line1: l1, line2: l2, line3: l3, line4: '' }
}

export function adaptOrderToDetailsView(o: any) {
  if (!o) return {}
  const dateTime = toUnixSeconds(o.date)
  const shipping = {
    deliveryFees: Number(o.deliveryFees || 0),
    estimatedMin: Number(o.estimatedMin || 0),
    estimatedMax: Number(o.estimatedMax || 0),
    shippingLogo: '',
    shippingVendor: o.shippingVendor || '',
  }
  const paymentSummary = {
    subTotal: Number(o.subTotal || 0),
    tax: Number(o.tax || 0),
    deliveryFees: Number(o.deliveryFees || 0),
    total: Number(o.grandTotal || 0),
  }
  const product = Array.isArray(o.items)
    ? o.items.map((it: any) => ({
        id: String(it.id),
        name: it.name,
        productCode: it.product?.productCode || '',
        img: it.img || '',
        price: Number(it.price || 0),
        quantity: Number(it.qty || 0),
        total: Number(it.price || 0) * Number(it.qty || 0),
        details: {},
      }))
    : []
  const customer = o.customer
    ? {
        id: o.customer.id,
        name: o.customer.name || '',
        email: o.customer.email || '',
        phone: o.customer.phoneNumber || '',
        img: o.customer.img || '',
        previousOrder: 0,
        shippingAddress: toAddressLines(o, 'shipping'),
        billingAddress: toAddressLines(o, 'billing'),
      }
    : undefined
  const payementStatus = o.paymentMethodId ? 0 : 1
  return {
    id: String(o.id),
    progressStatus: o.statusId || 0,
    payementStatus,
    dateTime,
    paymentSummary,
    shipping,
    product,
    activity: [],
    customer,
  }
}
