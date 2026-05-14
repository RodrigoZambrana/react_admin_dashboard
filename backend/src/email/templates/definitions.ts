import { EmailCategory, EmailTemplateVariant } from '@prisma/client'
import { wrapWithLayout } from './shared'

export type TemplateDefinition = {
  category: EmailCategory
  variant: EmailTemplateVariant
  locale: string
  version: number
  subject: string
  body: string
}

const styles = {
  heading: 'margin:0 0 12px;color:#111827;font-size:22px;line-height:1.35;font-weight:700;',
  sectionTitle: 'margin:0 0 12px;color:#111827;font-size:16px;line-height:1.4;font-weight:700;',
  paragraph: 'margin:0 0 16px;color:#111827;font-size:14px;line-height:1.7;',
  muted: 'margin:0;color:#6B7280;font-size:12px;line-height:1.6;',
  table: 'width:100%;border-collapse:collapse;margin:0 0 16px;',
  divider: 'margin:24px 0;border:none;border-top:1px solid #E5E7EB;',
  badge:
    'display:inline-block;margin-left:8px;padding:4px 10px;border-radius:999px;background:#EEF2FF;color:#4338CA;font-size:12px;font-weight:700;',
  button:
    'display:inline-block;padding:12px 20px;border-radius:10px;background:#111827;color:#FFFFFF !important;font-size:14px;font-weight:600;text-decoration:none;',
}

const divider = () => `<hr style="${styles.divider}" />`

const heading = (content: string) => `<h1 style="${styles.heading}">${content}</h1>`

const sectionTitle = (content: string) => `<h2 style="${styles.sectionTitle}">${content}</h2>`

const paragraph = (content: string, style = styles.paragraph) => `<p style="${style}">${content}</p>`

const tableRow = (label: string, value: string) => `
  <tr>
    <td style="padding:8px 0;color:#111827;font-size:14px;line-height:1.5;"><strong>${label}</strong></td>
    <td style="padding:8px 0;color:#111827;font-size:14px;line-height:1.5;text-align:right;">${value}</td>
  </tr>
`

const dataTable = (rows: string) => `<table role="presentation" style="${styles.table}"><tbody>${rows}</tbody></table>`

const buildOrderItemsTable = (labels: { item: string; qty: string; amount: string }) => `
<table role="presentation" style="${styles.table}">
  <thead>
    <tr>
      <th align="left" style="padding:8px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">${labels.item}</th>
      <th align="center" style="padding:8px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">${labels.qty}</th>
      <th align="right" style="padding:8px 0;border-bottom:1px solid #E5E7EB;color:#6B7280;font-size:12px;text-transform:uppercase;letter-spacing:0.04em;">${labels.amount}</th>
    </tr>
  </thead>
  <tbody>
    {{#each payload.items}}
      <tr>
        <td style="padding:10px 0;border-bottom:1px solid #F3F4F6;color:#111827;font-size:14px;line-height:1.6;">
          <div>{{this.name}}</div>
          {{#if this.description}}
            <div style="margin-top:4px;color:#6B7280;font-size:12px;line-height:1.5;">{{this.description}}</div>
          {{/if}}
        </td>
        <td align="center" style="padding:10px 0;border-bottom:1px solid #F3F4F6;color:#111827;font-size:14px;line-height:1.6;">{{this.quantity}}</td>
        <td align="right" style="padding:10px 0;border-bottom:1px solid #F3F4F6;color:#111827;font-size:14px;line-height:1.6;">{{formatCurrency this.subtotalRaw ../payload.totals.currency}}</td>
      </tr>
    {{/each}}
  </tbody>
</table>
`

const buildTotalsBlock = (labels: { subtotal: string; tax: string; total: string }) =>
  dataTable(`
    ${tableRow(labels.subtotal, '{{formatCurrency payload.totals.subtotalRaw payload.totals.currency}}')}
    {{#if payload.totals.taxRaw}}
      ${tableRow(labels.tax, '{{formatCurrency payload.totals.taxRaw payload.totals.currency}}')}
    {{/if}}
    ${tableRow(labels.total, '<strong>{{formatCurrency payload.totals.grandTotalRaw payload.totals.currency}}</strong>')}
  `)

const buildButton = (href: string, label: string) => `
  <table role="presentation" style="margin:0 0 16px;">
    <tbody>
      <tr>
        <td>
          <a href="${href}" style="${styles.button}">${label}</a>
        </td>
      </tr>
    </tbody>
  </table>
`

const buildCustomerCta = (locale: 'en' | 'es') => {
  const labels =
    locale === 'en'
      ? {
          review: 'Review quote',
          confirm: 'View confirmation',
          openQuote: 'Open quote',
          viewOrder: 'View order',
          feedback: 'Share feedback',
          track: 'Track order',
        }
      : {
          review: 'Ver presupuesto',
          confirm: 'Ver confirmación',
          openQuote: 'Abrir presupuesto',
          viewOrder: 'Ver pedido',
          feedback: 'Compartir comentario',
          track: 'Seguir pedido',
        }

  return `
{{#if (or payload.links.customer payload.portalUrl)}}
  {{#if (eq payload.documentType 'BUDGET')}}
    {{#if (eq payload.event 'budget.created')}}
      ${buildButton("{{default (default payload.links.customer payload.portalUrl) '#'}}", labels.review)}
    {{else}}
      {{#if (eq payload.event 'budget.status.accepted')}}
        ${buildButton("{{default (default payload.links.customer payload.portalUrl) '#'}}", labels.confirm)}
      {{else}}
        ${buildButton("{{default (default payload.links.customer payload.portalUrl) '#'}}", labels.openQuote)}
      {{/if}}
    {{/if}}
  {{else}}
    {{#if (eq payload.event 'order.received')}}
      ${buildButton("{{default (default payload.links.customer payload.portalUrl) '#'}}", labels.viewOrder)}
    {{else}}
      {{#if (eq payload.event 'order.status.delivered')}}
        ${buildButton("{{default (default payload.links.customer payload.portalUrl) '#'}}", labels.feedback)}
      {{else}}
        ${buildButton("{{default (default payload.links.customer payload.portalUrl) '#'}}", labels.track)}
      {{/if}}
    {{/if}}
  {{/if}}
{{/if}}
`
}

const buildAdminCta = (locale: 'en' | 'es') => `
{{#if (or payload.links.admin payload.adminUrl)}}
  ${buildButton("{{default (default payload.links.admin payload.adminUrl) '#'}}", locale === 'en' ? 'Open in dashboard' : 'Abrir en panel')}
{{/if}}
`

const buildAddressBlock = (label: string, linesExpression: string) =>
  paragraph(`<strong>${label}</strong><br/>${linesExpression}`)

const orderItemsTableEn = buildOrderItemsTable({ item: 'Item', qty: 'Qty', amount: 'Amount' })
const orderItemsTableEs = buildOrderItemsTable({ item: 'Producto', qty: 'Cant.', amount: 'Importe' })
const totalsBlockEn = buildTotalsBlock({ subtotal: 'Subtotal', tax: 'Tax', total: 'Total' })
const totalsBlockEs = buildTotalsBlock({ subtotal: 'Subtotal', tax: 'Impuestos', total: 'Total' })

const orderCustomerSubjectEn = `{{eventLabel payload.event}} {{#if payload.orderNumber}}#{{payload.orderNumber}}{{/if}}`
const orderCustomerSubjectEs = `{{eventLabel payload.event}} {{#if payload.orderNumber}}#{{payload.orderNumber}}{{/if}}`
const orderAdminSubjectEn = `[{{companyName}} - Admin] New order received {{#if payload.orderNumber}}#{{payload.orderNumber}}{{/if}}`
const orderAdminSubjectEs = `[{{companyName}} - Admin] Nuevo pedido recibido {{#if payload.orderNumber}}#{{payload.orderNumber}}{{/if}}`

const orderCustomerEn = wrapWithLayout(`
${heading("{{#if payload.customer.name}}{{payload.customer.name}}, {{/if}}{{eventLabel payload.event}}!{{#if payload.orderNumber}} <span style='" + styles.badge + "'>#{{payload.orderNumber}}</span>{{/if}}")}
${paragraph('{{eventMessage payload}}')}
${dataTable(`
  ${tableRow('Order number', '{{default payload.orderNumber payload.orderId}}')}
  ${tableRow('Order date', '{{payload.orderDate}}')}
  {{#if payload.status}}
    ${tableRow('Current status', '{{payload.status}}')}
  {{/if}}
  ${tableRow('Total', '{{formatCurrency payload.totals.grandTotalRaw payload.totals.currency}}')}
  {{#if payload.paymentMethod}}
    ${tableRow('Payment method', '{{payload.paymentMethod}}')}
  {{/if}}
  {{#if payload.validUntil}}
    ${tableRow('Valid until', '{{payload.validUntil}}')}
  {{/if}}
`)}
${divider()}
${sectionTitle('Order summary')}
${orderItemsTableEn}
${totalsBlockEn}
{{#if (or payload.deliveryEstimateLabel payload.shippingVendor payload.shippingAddress payload.billingAddress)}}
  ${divider()}
  ${sectionTitle('Delivery information')}
  ${dataTable(`
    {{#if payload.shippingVendor}}
      ${tableRow('Carrier', '{{payload.shippingVendor}}')}
    {{/if}}
    {{#if payload.deliveryEstimateLabel}}
      ${tableRow('Estimated delivery', '{{payload.deliveryEstimateLabel}}')}
    {{/if}}
  `)}
  {{#if payload.shippingAddress}}
    ${buildAddressBlock('Shipping address', '{{#each payload.shippingAddress.lines}}{{this}}<br/>{{/each}}')}
  {{/if}}
  {{#if payload.billingAddress}}
    ${buildAddressBlock('Billing address', '{{#each payload.billingAddress.lines}}{{this}}<br/>{{/each}}')}
  {{/if}}
{{/if}}
{{#if payload.notes}}
  ${divider()}
  ${paragraph('<strong>Notes:</strong> {{payload.notes}}')}
{{/if}}
${divider()}
${buildCustomerCta('en')}
${paragraph('Need help? Reply to this email or contact us at {{companyFooter}}.', styles.muted)}
`)

const orderCustomerEs = wrapWithLayout(`
${heading("{{#if payload.customer.name}}{{payload.customer.name}}, {{/if}}{{eventLabel payload.event}}!{{#if payload.orderNumber}} <span style='" + styles.badge + "'>#{{payload.orderNumber}}</span>{{/if}}")}
${paragraph('{{eventMessage payload}}')}
${dataTable(`
  ${tableRow('Número de pedido', '{{default payload.orderNumber payload.orderId}}')}
  ${tableRow('Fecha del pedido', '{{payload.orderDate}}')}
  {{#if payload.status}}
    ${tableRow('Estado actual', '{{payload.status}}')}
  {{/if}}
  ${tableRow('Total', '{{formatCurrency payload.totals.grandTotalRaw payload.totals.currency}}')}
  {{#if payload.paymentMethod}}
    ${tableRow('Método de pago', '{{payload.paymentMethod}}')}
  {{/if}}
  {{#if payload.validUntil}}
    ${tableRow('Válido hasta', '{{payload.validUntil}}')}
  {{/if}}
`)}
${divider()}
${sectionTitle('Resumen del pedido')}
${orderItemsTableEs}
${totalsBlockEs}
{{#if (or payload.deliveryEstimateLabel payload.shippingVendor payload.shippingAddress payload.billingAddress)}}
  ${divider()}
  ${sectionTitle('Información de entrega')}
  ${dataTable(`
    {{#if payload.shippingVendor}}
      ${tableRow('Transportista', '{{payload.shippingVendor}}')}
    {{/if}}
    {{#if payload.deliveryEstimateLabel}}
      ${tableRow('Tiempo estimado', '{{payload.deliveryEstimateLabel}}')}
    {{/if}}
  `)}
  {{#if payload.shippingAddress}}
    ${buildAddressBlock('Dirección de envío', '{{#each payload.shippingAddress.lines}}{{this}}<br/>{{/each}}')}
  {{/if}}
  {{#if payload.billingAddress}}
    ${buildAddressBlock('Dirección de facturación', '{{#each payload.billingAddress.lines}}{{this}}<br/>{{/each}}')}
  {{/if}}
{{/if}}
{{#if payload.notes}}
  ${divider()}
  ${paragraph('<strong>Notas:</strong> {{payload.notes}}')}
{{/if}}
${divider()}
${buildCustomerCta('es')}
${paragraph('¿Necesitás ayuda? Respondé este correo o escribinos a {{companyFooter}}.', styles.muted)}
`)

const orderAdminEn = wrapWithLayout(`
${heading("{{eventLabel payload.event}}{{#if payload.orderNumber}} <span style='" + styles.badge + "'>#{{payload.orderNumber}}</span>{{/if}}")}
${paragraph('{{eventAdminMessage payload}}')}
${dataTable(`
  ${tableRow('Order number', '{{default payload.orderNumber payload.orderId}}')}
  ${tableRow('Customer', '{{default payload.customer.name payload.customer.email}} ({{payload.customer.email}})')}
  {{#if payload.customer.phone}}
    ${tableRow('Phone', '{{payload.customer.phone}}')}
  {{/if}}
  ${tableRow('Order date', '{{payload.orderDate}}')}
  {{#if payload.status}}
    ${tableRow('Status', '{{payload.status}}')}
  {{/if}}
  {{#if payload.previousStatus}}
    ${tableRow('Previous status', '{{payload.previousStatus}}')}
  {{/if}}
  ${tableRow('Total', '{{formatCurrency payload.totals.grandTotalRaw payload.totals.currency}}')}
  {{#if payload.paymentMethod}}
    ${tableRow('Payment method', '{{payload.paymentMethod}}')}
  {{/if}}
`)}
${divider()}
${sectionTitle('Order summary')}
${orderItemsTableEn}
${totalsBlockEn}
{{#if (or payload.deliveryEstimateLabel payload.shippingVendor payload.shippingAddress payload.billingAddress)}}
  ${divider()}
  ${sectionTitle('Delivery & addresses')}
  ${dataTable(`
    {{#if payload.shippingVendor}}
      ${tableRow('Carrier', '{{payload.shippingVendor}}')}
    {{/if}}
    {{#if payload.deliveryEstimateLabel}}
      ${tableRow('Estimated delivery', '{{payload.deliveryEstimateLabel}}')}
    {{/if}}
  `)}
  {{#if payload.shippingAddress}}
    ${buildAddressBlock('Shipping address', '{{#each payload.shippingAddress.lines}}{{this}}<br/>{{/each}}')}
  {{/if}}
  {{#if payload.billingAddress}}
    ${buildAddressBlock('Billing address', '{{#each payload.billingAddress.lines}}{{this}}<br/>{{/each}}')}
  {{/if}}
{{/if}}
{{#if payload.notes}}
  ${divider()}
  ${paragraph('<strong>Notes:</strong> {{payload.notes}}')}
{{/if}}
${divider()}
${buildAdminCta('en')}
${paragraph('Automated notification generated by the system.', styles.muted)}
`)

const orderAdminEs = wrapWithLayout(`
${heading("{{eventLabel payload.event}}{{#if payload.orderNumber}} <span style='" + styles.badge + "'>#{{payload.orderNumber}}</span>{{/if}}")}
${paragraph('{{eventAdminMessage payload}}')}
${dataTable(`
  ${tableRow('Número de pedido', '{{default payload.orderNumber payload.orderId}}')}
  ${tableRow('Cliente', '{{default payload.customer.name payload.customer.email}} ({{payload.customer.email}})')}
  {{#if payload.customer.phone}}
    ${tableRow('Teléfono', '{{payload.customer.phone}}')}
  {{/if}}
  ${tableRow('Fecha del pedido', '{{payload.orderDate}}')}
  {{#if payload.status}}
    ${tableRow('Estado', '{{payload.status}}')}
  {{/if}}
  {{#if payload.previousStatus}}
    ${tableRow('Estado anterior', '{{payload.previousStatus}}')}
  {{/if}}
  ${tableRow('Total', '{{formatCurrency payload.totals.grandTotalRaw payload.totals.currency}}')}
  {{#if payload.paymentMethod}}
    ${tableRow('Método de pago', '{{payload.paymentMethod}}')}
  {{/if}}
`)}
${divider()}
${sectionTitle('Resumen del pedido')}
${orderItemsTableEs}
${totalsBlockEs}
{{#if (or payload.deliveryEstimateLabel payload.shippingVendor payload.shippingAddress payload.billingAddress)}}
  ${divider()}
  ${sectionTitle('Información de entrega y direcciones')}
  ${dataTable(`
    {{#if payload.shippingVendor}}
      ${tableRow('Transportista', '{{payload.shippingVendor}}')}
    {{/if}}
    {{#if payload.deliveryEstimateLabel}}
      ${tableRow('Tiempo estimado', '{{payload.deliveryEstimateLabel}}')}
    {{/if}}
  `)}
  {{#if payload.shippingAddress}}
    ${buildAddressBlock('Dirección de envío', '{{#each payload.shippingAddress.lines}}{{this}}<br/>{{/each}}')}
  {{/if}}
  {{#if payload.billingAddress}}
    ${buildAddressBlock('Dirección de facturación', '{{#each payload.billingAddress.lines}}{{this}}<br/>{{/each}}')}
  {{/if}}
{{/if}}
{{#if payload.notes}}
  ${divider()}
  ${paragraph('<strong>Notas:</strong> {{payload.notes}}')}
{{/if}}
${divider()}
${buildAdminCta('es')}
${paragraph('Notificación automática generada por el sistema.', styles.muted)}
`)

const paymentCustomerEn = wrapWithLayout(`
${heading('{{#if payload.isFullyPaid}}Payment confirmed{{else}}Partial payment received{{/if}}')}
${paragraph(
  '{{#if payload.isFullyPaid}}We confirmed your payment for order {{#if payload.orderNumber}}#{{payload.orderNumber}}{{else}}#{{payload.orderId}}{{/if}}. Your purchase is fully paid and continues to the next stage.{{else}}We confirmed a partial payment for order {{#if payload.orderNumber}}#{{payload.orderNumber}}{{else}}#{{payload.orderId}}{{/if}}. The remaining balance is shown below.{{/if}}',
)}
${dataTable(`
  ${tableRow('Order number', '{{default payload.orderNumber payload.orderId}}')}
  {{#if payload.orderDate}}
    ${tableRow('Order date', '{{payload.orderDate}}')}
  {{/if}}
  {{#if payload.orderStatus}}
    ${tableRow('Order status', '{{payload.orderStatus}}')}
  {{/if}}
  ${tableRow('Payment amount', '{{formatCurrency payload.amountRaw payload.currency}}')}
  ${tableRow('Paid so far', '{{formatCurrency payload.totals.totalPaidRaw payload.totals.currency}}')}
  ${tableRow('Remaining balance', '{{formatCurrency payload.totals.remainingRaw payload.totals.currency}}')}
  ${tableRow('Order total', '{{formatCurrency payload.totals.grandTotalRaw payload.totals.currency}}')}
  ${tableRow('Payment status', '{{payload.statusLabel}}')}
  ${tableRow('Method', '{{payload.method}}')}
  ${tableRow('Reference', '{{#if payload.paymentId}}#{{payload.paymentId}}{{else}}-{{/if}}')}
  {{#if payload.reference}}
    ${tableRow('Provider reference', '{{payload.reference}}')}
  {{/if}}
  ${tableRow('Processed at', '{{payload.processedAt}}')}
`)}
${divider()}
${sectionTitle('Order summary')}
${orderItemsTableEn}
${dataTable(`
  ${tableRow('Paid so far', '{{formatCurrency payload.totals.totalPaidRaw payload.totals.currency}}')}
  ${tableRow('Remaining balance', '{{formatCurrency payload.totals.remainingRaw payload.totals.currency}}')}
  ${tableRow('Order total', '<strong>{{formatCurrency payload.totals.grandTotalRaw payload.totals.currency}}</strong>')}
`)}
{{#if payload.links.customer}}
  ${buildButton('{{payload.links.customer}}', 'View order details')}
{{else if payload.portalUrl}}
  ${buildButton('{{payload.portalUrl}}', 'View your orders')}
{{/if}}
{{#if payload.portalUrl}}
  ${paragraph('You can review the latest status from your customer account.', styles.muted)}
{{/if}}
${paragraph('Keep this receipt for your records.', styles.muted)}
`)

const paymentCustomerEs = wrapWithLayout(`
${heading('{{#if payload.isFullyPaid}}Pago confirmado{{else}}Pago parcial recibido{{/if}}')}
${paragraph(
  '{{#if payload.isFullyPaid}}Confirmamos tu pago para el pedido {{#if payload.orderNumber}}#{{payload.orderNumber}}{{else}}#{{payload.orderId}}{{/if}}. Tu compra quedó totalmente pagada y sigue a la próxima etapa.{{else}}Confirmamos un pago parcial para el pedido {{#if payload.orderNumber}}#{{payload.orderNumber}}{{else}}#{{payload.orderId}}{{/if}}. El saldo pendiente se muestra debajo.{{/if}}',
)}
${dataTable(`
  ${tableRow('Número de pedido', '{{default payload.orderNumber payload.orderId}}')}
  {{#if payload.orderDate}}
    ${tableRow('Fecha del pedido', '{{payload.orderDate}}')}
  {{/if}}
  {{#if payload.orderStatus}}
    ${tableRow('Estado del pedido', '{{payload.orderStatus}}')}
  {{/if}}
  ${tableRow('Monto del pago', '{{formatCurrency payload.amountRaw payload.currency}}')}
  ${tableRow('Pagado hasta ahora', '{{formatCurrency payload.totals.totalPaidRaw payload.totals.currency}}')}
  ${tableRow('Saldo pendiente', '{{formatCurrency payload.totals.remainingRaw payload.totals.currency}}')}
  ${tableRow('Total del pedido', '{{formatCurrency payload.totals.grandTotalRaw payload.totals.currency}}')}
  ${tableRow('Estado del pago', '{{payload.statusLabel}}')}
  ${tableRow('Método', '{{payload.method}}')}
  ${tableRow('Referencia', '{{#if payload.paymentId}}#{{payload.paymentId}}{{else}}-{{/if}}')}
  {{#if payload.reference}}
    ${tableRow('Referencia del proveedor', '{{payload.reference}}')}
  {{/if}}
  ${tableRow('Procesado el', '{{payload.processedAt}}')}
`)}
${divider()}
${sectionTitle('Resumen del pedido')}
${orderItemsTableEs}
${dataTable(`
  ${tableRow('Pagado hasta ahora', '{{formatCurrency payload.totals.totalPaidRaw payload.totals.currency}}')}
  ${tableRow('Saldo pendiente', '{{formatCurrency payload.totals.remainingRaw payload.totals.currency}}')}
  ${tableRow('Total del pedido', '<strong>{{formatCurrency payload.totals.grandTotalRaw payload.totals.currency}}</strong>')}
`)}
{{#if payload.links.customer}}
  ${buildButton('{{payload.links.customer}}', 'Ver detalle del pedido')}
{{else if payload.portalUrl}}
  ${buildButton('{{payload.portalUrl}}', 'Ver mis compras')}
{{/if}}
{{#if payload.portalUrl}}
  ${paragraph('Podés revisar el estado actualizado desde tu cuenta de cliente.', styles.muted)}
{{/if}}
${paragraph('Guardá este comprobante para tus registros.', styles.muted)}
`)

const paymentAdminEn = wrapWithLayout(`
${heading('Payment received')}
${paragraph(
  'A payment was recorded for order {{#if payload.orderNumber}}#{{payload.orderNumber}}{{else}}#{{payload.orderId}}{{/if}}. Review the settlement details below.',
)}
${dataTable(`
  ${tableRow('Order number', '{{default payload.orderNumber payload.orderId}}')}
  ${tableRow('Customer', '{{payload.customer.name}} ({{payload.customer.email}})')}
  {{#if payload.customer.phone}}
    ${tableRow('Phone', '{{payload.customer.phone}}')}
  {{/if}}
  {{#if payload.orderStatus}}
    ${tableRow('Order status', '{{payload.orderStatus}}')}
  {{/if}}
  ${tableRow('Payment amount', '{{formatCurrency payload.amountRaw payload.currency}}')}
  ${tableRow('Paid so far', '{{formatCurrency payload.totals.totalPaidRaw payload.totals.currency}}')}
  ${tableRow('Remaining balance', '{{formatCurrency payload.totals.remainingRaw payload.totals.currency}}')}
  ${tableRow('Order total', '{{formatCurrency payload.totals.grandTotalRaw payload.totals.currency}}')}
  ${tableRow('Payment status', '{{payload.statusLabel}}')}
  ${tableRow('Method', '{{payload.method}}')}
  ${tableRow('Reference', '{{#if payload.paymentId}}#{{payload.paymentId}}{{else}}-{{/if}}')}
  {{#if payload.reference}}
    ${tableRow('Provider reference', '{{payload.reference}}')}
  {{/if}}
  ${tableRow('Processed at', '{{payload.processedAt}}')}
`)}
${divider()}
${sectionTitle('Order summary')}
${orderItemsTableEn}
${dataTable(`
  ${tableRow('Paid so far', '{{formatCurrency payload.totals.totalPaidRaw payload.totals.currency}}')}
  ${tableRow('Remaining balance', '{{formatCurrency payload.totals.remainingRaw payload.totals.currency}}')}
  ${tableRow('Order total', '<strong>{{formatCurrency payload.totals.grandTotalRaw payload.totals.currency}}</strong>')}
`)}
{{#if payload.links.admin}}
  ${buildButton('{{payload.links.admin}}', 'Open order in dashboard')}
{{else if payload.adminUrl}}
  ${buildButton('{{payload.adminUrl}}', 'Open dashboard')}
{{/if}}
`)

const paymentAdminEs = wrapWithLayout(`
${heading('Pago recibido')}
${paragraph(
  'Se registró un pago para el pedido {{#if payload.orderNumber}}#{{payload.orderNumber}}{{else}}#{{payload.orderId}}{{/if}}. Revisá debajo el estado de cobranza.',
)}
${dataTable(`
  ${tableRow('Número de pedido', '{{default payload.orderNumber payload.orderId}}')}
  ${tableRow('Cliente', '{{payload.customer.name}} ({{payload.customer.email}})')}
  {{#if payload.customer.phone}}
    ${tableRow('Teléfono', '{{payload.customer.phone}}')}
  {{/if}}
  {{#if payload.orderStatus}}
    ${tableRow('Estado del pedido', '{{payload.orderStatus}}')}
  {{/if}}
  ${tableRow('Monto del pago', '{{formatCurrency payload.amountRaw payload.currency}}')}
  ${tableRow('Pagado hasta ahora', '{{formatCurrency payload.totals.totalPaidRaw payload.totals.currency}}')}
  ${tableRow('Saldo pendiente', '{{formatCurrency payload.totals.remainingRaw payload.totals.currency}}')}
  ${tableRow('Total del pedido', '{{formatCurrency payload.totals.grandTotalRaw payload.totals.currency}}')}
  ${tableRow('Estado del pago', '{{payload.statusLabel}}')}
  ${tableRow('Método', '{{payload.method}}')}
  ${tableRow('Referencia', '{{#if payload.paymentId}}#{{payload.paymentId}}{{else}}-{{/if}}')}
  {{#if payload.reference}}
    ${tableRow('Referencia del proveedor', '{{payload.reference}}')}
  {{/if}}
  ${tableRow('Procesado el', '{{payload.processedAt}}')}
`)}
${divider()}
${sectionTitle('Resumen del pedido')}
${orderItemsTableEs}
${dataTable(`
  ${tableRow('Pagado hasta ahora', '{{formatCurrency payload.totals.totalPaidRaw payload.totals.currency}}')}
  ${tableRow('Saldo pendiente', '{{formatCurrency payload.totals.remainingRaw payload.totals.currency}}')}
  ${tableRow('Total del pedido', '<strong>{{formatCurrency payload.totals.grandTotalRaw payload.totals.currency}}</strong>')}
`)}
{{#if payload.links.admin}}
  ${buildButton('{{payload.links.admin}}', 'Abrir pedido en el panel')}
{{else if payload.adminUrl}}
  ${buildButton('{{payload.adminUrl}}', 'Abrir panel')}
{{/if}}
`)

const resetCustomerEn = wrapWithLayout(`
${heading(
  "{{#if (eq payload.event 'welcome')}}Welcome to {{companyName}}{{else if (eq payload.event 'verify_email')}}Confirm your email{{else if (eq payload.event 'password_changed')}}Your password was updated{{else if (eq payload.event 'recovery_notice')}}Password recovery requested{{else}}Reset your password{{/if}}",
)}
${paragraph(
  "{{#if (eq payload.event 'welcome')}}Hello {{payload.displayName}}, your account is ready. From now on you can follow orders, manage saved addresses and discover everything available in the store from one place.{{else if (eq payload.event 'verify_email')}}Hello {{payload.displayName}}, confirm your email address to finish activating your account and receive updates about orders, payments and account activity.{{#if payload.expiresAt}} This link expires on {{payload.expiresAt}}.{{/if}}{{else if (eq payload.event 'password_changed')}}Hello {{payload.displayName}}, your password was just updated. If you did not make this change, secure your account immediately.{{else if (eq payload.event 'recovery_notice')}}Hello {{payload.displayName}}, we received a request to recover access to your account. If it was you, follow the steps below. If not, secure your account to keep it safe.{{else}}Hello {{payload.displayName}}, we received a request to reset your password. Use the button below to choose a new one.{{#if payload.expiresAt}} This link expires on {{payload.expiresAt}}.{{/if}}{{/if}}",
)}
{{#if (eq payload.event 'welcome')}}
  {{#if payload.accountUrl}}
    ${buildButton('{{payload.accountUrl}}', 'Go to my account')}
  {{/if}}
  ${paragraph('Use your account to track purchases, manage delivery details and continue browsing the products and solutions available on the site.', styles.muted)}
{{else if (eq payload.event 'verify_email')}}
  {{#if payload.resetUrl}}
    ${buildButton('{{payload.resetUrl}}', 'Confirm email')}
  {{/if}}
  {{#if payload.accountUrl}}
    ${buildButton('{{payload.accountUrl}}', 'Open my account')}
  {{/if}}
  ${paragraph('Once your email is confirmed, we will use it as the main channel for order updates and account security notifications.', styles.muted)}
{{else if payload.resetUrl}}
  ${buildButton(
    '{{payload.resetUrl}}',
    "{{#if (eq payload.event 'reset_link')}}Reset password{{else}}Secure account{{/if}}",
  )}
{{/if}}
${paragraph(
  "{{#if (eq payload.event 'welcome')}}If you need help getting started, reply to this email and our team will assist you.{{else if (eq payload.event 'verify_email')}}If you did not create this account, you can safely ignore this message.{{else if (eq payload.event 'password_changed')}}If you did not authorize this change, secure your account or contact us immediately.{{else if (eq payload.event 'recovery_notice')}}If this wasn't you, secure your account to prevent unauthorized access.{{else}}Didn't request this? You can safely ignore this email.{{/if}}",
  styles.muted,
)}
`)

const resetCustomerEs = wrapWithLayout(`
${heading(
  "{{#if (eq payload.event 'welcome')}}Bienvenido a {{companyName}}{{else if (eq payload.event 'verify_email')}}Confirmá tu correo electrónico{{else if (eq payload.event 'password_changed')}}Tu contraseña fue actualizada{{else if (eq payload.event 'recovery_notice')}}Solicitud de recuperación{{else}}Restablecé tu contraseña{{/if}}",
)}
${paragraph(
  "{{#if (eq payload.event 'welcome')}}Hola {{payload.displayName}}, tu cuenta ya está lista. Desde ahora podés seguir tus pedidos, administrar direcciones guardadas y descubrir todo lo que ya podés comprar en el sitio desde un mismo lugar.{{else if (eq payload.event 'verify_email')}}Hola {{payload.displayName}}, confirmá tu correo electrónico para terminar de activar tu cuenta y recibir novedades sobre pedidos, pagos y movimientos de tu cuenta.{{#if payload.expiresAt}} Este enlace vence el {{payload.expiresAt}}.{{/if}}{{else if (eq payload.event 'password_changed')}}Hola {{payload.displayName}}, acabamos de actualizar tu contraseña. Si no fuiste vos, asegurá tu cuenta de inmediato.{{else if (eq payload.event 'recovery_notice')}}Hola {{payload.displayName}}, recibimos una solicitud para recuperar el acceso a tu cuenta. Si fuiste vos, seguí los pasos a continuación. Si no la hiciste, protegé tu cuenta.{{else}}Hola {{payload.displayName}}, recibimos una solicitud para restablecer tu contraseña. Utilizá el siguiente botón para crear una nueva.{{#if payload.expiresAt}} El enlace vence el {{payload.expiresAt}}.{{/if}}{{/if}}",
)}
{{#if (eq payload.event 'welcome')}}
  {{#if payload.accountUrl}}
    ${buildButton('{{payload.accountUrl}}', 'Ir a mi cuenta')}
  {{/if}}
  ${paragraph('Usá tu cuenta para seguir compras, gestionar entregas y seguir explorando productos y soluciones publicadas en el sitio.', styles.muted)}
{{else if (eq payload.event 'verify_email')}}
  {{#if payload.resetUrl}}
    ${buildButton('{{payload.resetUrl}}', 'Confirmar correo')}
  {{/if}}
  {{#if payload.accountUrl}}
    ${buildButton('{{payload.accountUrl}}', 'Acceder a mi cuenta')}
  {{/if}}
  ${paragraph('Una vez confirmado tu correo, lo usaremos como canal principal para avisos de pedidos y notificaciones de seguridad de tu cuenta.', styles.muted)}
{{else if payload.resetUrl}}
  ${buildButton(
    '{{payload.resetUrl}}',
    "{{#if (eq payload.event 'reset_link')}}Restablecer contraseña{{else}}Proteger cuenta{{/if}}",
  )}
{{/if}}
${paragraph(
  "{{#if (eq payload.event 'welcome')}}Si necesitás ayuda para empezar, respondé este correo y te ayudaremos.{{else if (eq payload.event 'verify_email')}}Si no creaste esta cuenta, podés ignorar este mensaje.{{else if (eq payload.event 'password_changed')}}Si no realizaste este cambio, asegurá tu cuenta o contactanos de inmediato.{{else if (eq payload.event 'recovery_notice')}}Si no fuiste vos, protegé tu cuenta para evitar accesos no autorizados.{{else}}¿No solicitaste esto? Podés ignorar este mensaje.{{/if}}",
  styles.muted,
)}
`)

const resetAdminEn = wrapWithLayout(`
${heading(
  "{{#if (eq payload.event 'password_changed')}}Administrator password updated{{else if (eq payload.event 'recovery_notice')}}Administrator recovery requested{{else}}Admin password reset{{/if}}",
)}
${paragraph(
  "{{#if (eq payload.event 'password_changed')}}Hi {{payload.displayName}}, your administrator password was updated. If you didn't authorize this change, secure your account and alert the security team.{{else if (eq payload.event 'recovery_notice')}}Hi {{payload.displayName}}, we received a request to recover your administrator account. If this wasn't you, secure your account immediately.{{else}}Hi {{payload.displayName}}, you requested to reset your administrator password. Click the button below to continue.{{#if payload.expiresAt}} The link expires on {{payload.expiresAt}}.{{/if}}{{/if}}",
)}
{{#if payload.resetUrl}}
  ${buildButton(
    '{{payload.resetUrl}}',
    "{{#if (eq payload.event 'reset_link')}}Reset administrator password{{else}}Secure administrator account{{/if}}",
  )}
{{/if}}
${paragraph(
  "{{#if (eq payload.event 'reset_link')}}If you no longer need this, you can safely ignore this email.{{else}}If this wasn't you, contact an administrator immediately.{{/if}}",
  styles.muted,
)}
`)

const resetAdminEs = wrapWithLayout(`
${heading(
  "{{#if (eq payload.event 'password_changed')}}Contraseña de administrador actualizada{{else if (eq payload.event 'recovery_notice')}}Solicitud de recuperación de administrador{{else}}Restablecer contraseña de administrador{{/if}}",
)}
${paragraph(
  "{{#if (eq payload.event 'password_changed')}}Hola {{payload.displayName}}, tu contraseña de administrador fue actualizada. Si no fuiste vos, asegurá la cuenta y avisá al equipo de seguridad.{{else if (eq payload.event 'recovery_notice')}}Hola {{payload.displayName}}, recibimos una solicitud para recuperar tu cuenta de administrador. Si no la hiciste, protegé tu cuenta de inmediato.{{else}}Hola {{payload.displayName}}, solicitaste restablecer tu contraseña de administrador. Hacé clic en el botón para continuar.{{#if payload.expiresAt}} El enlace vence el {{payload.expiresAt}}.{{/if}}{{/if}}",
)}
{{#if payload.resetUrl}}
  ${buildButton(
    '{{payload.resetUrl}}',
    "{{#if (eq payload.event 'reset_link')}}Restablecer contraseña{{else}}Proteger cuenta de administrador{{/if}}",
  )}
{{/if}}
${paragraph(
  "{{#if (eq payload.event 'reset_link')}}Si ya no necesitás esta acción, podés ignorar este mensaje.{{else}}Si no fuiste vos, contactá a un administrador de inmediato.{{/if}}",
  styles.muted,
)}
`)

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    category: EmailCategory.ORDERS,
    variant: EmailTemplateVariant.CUSTOMER,
    locale: 'en',
    version: 7,
    subject: orderCustomerSubjectEn,
    body: orderCustomerEn,
  },
  {
    category: EmailCategory.ORDERS,
    variant: EmailTemplateVariant.CUSTOMER,
    locale: 'es',
    version: 7,
    subject: orderCustomerSubjectEs,
    body: orderCustomerEs,
  },
  {
    category: EmailCategory.ORDERS,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'en',
    version: 7,
    subject: orderAdminSubjectEn,
    body: orderAdminEn,
  },
  {
    category: EmailCategory.ORDERS,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'es',
    version: 7,
    subject: orderAdminSubjectEs,
    body: orderAdminEs,
  },
  {
    category: EmailCategory.PAYMENTS,
    variant: EmailTemplateVariant.CUSTOMER,
    locale: 'en',
    version: 4,
    subject: 'Payment received for order #{{payload.orderNumber}}',
    body: paymentCustomerEn,
  },
  {
    category: EmailCategory.PAYMENTS,
    variant: EmailTemplateVariant.CUSTOMER,
    locale: 'es',
    version: 4,
    subject: 'Pago recibido para el pedido #{{payload.orderNumber}}',
    body: paymentCustomerEs,
  },
  {
    category: EmailCategory.PAYMENTS,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'en',
    version: 3,
    subject: '[Payments] Payment received for order #{{payload.orderNumber}}',
    body: paymentAdminEn,
  },
  {
    category: EmailCategory.PAYMENTS,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'es',
    version: 3,
    subject: '[Pagos] Pago registrado para el pedido #{{payload.orderNumber}}',
    body: paymentAdminEs,
  },
  {
    category: EmailCategory.AUTH,
    variant: EmailTemplateVariant.CUSTOMER,
    locale: 'en',
    version: 4,
    subject:
      "{{#if (eq payload.event 'welcome')}}Welcome to {{companyName}}{{else if (eq payload.event 'verify_email')}}Confirm your email for {{companyName}}{{else if (eq payload.event 'password_changed')}}Your {{companyName}} password was updated{{else if (eq payload.event 'recovery_notice')}}Password recovery requested for {{companyName}}{{else}}Reset your {{companyName}} password{{/if}}",
    body: resetCustomerEn,
  },
  {
    category: EmailCategory.AUTH,
    variant: EmailTemplateVariant.CUSTOMER,
    locale: 'es',
    version: 4,
    subject:
      "{{#if (eq payload.event 'welcome')}}Bienvenido a {{companyName}}{{else if (eq payload.event 'verify_email')}}Confirmá tu correo para {{companyName}}{{else if (eq payload.event 'password_changed')}}Tu contraseña de {{companyName}} fue actualizada{{else if (eq payload.event 'recovery_notice')}}Solicitud de recuperación para {{companyName}}{{else}}Restablecé tu contraseña de {{companyName}}{{/if}}",
    body: resetCustomerEs,
  },
  {
    category: EmailCategory.AUTH,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'en',
    version: 3,
    subject:
      "{{#if (eq payload.event 'password_changed')}}Administrator password updated{{else if (eq payload.event 'recovery_notice')}}Administrator recovery requested{{else}}Reset your administrator password{{/if}}",
    body: resetAdminEn,
  },
  {
    category: EmailCategory.AUTH,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'es',
    version: 3,
    subject:
      "{{#if (eq payload.event 'password_changed')}}Contraseña de administrador actualizada{{else if (eq payload.event 'recovery_notice')}}Solicitud de recuperación de administrador{{else}}Restablecer contraseña de administrador{{/if}}",
    body: resetAdminEs,
  },
]
