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

const orderCustomerSubjectEn = `[{{companyName}}] {{eventLabel payload.event}} {{#if payload.orderNumber}}#{{payload.orderNumber}}{{/if}}`
const orderCustomerSubjectEs = `[{{companyName}}] {{eventLabel payload.event}} {{#if payload.orderNumber}}#{{payload.orderNumber}}{{/if}}`
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
${heading('Payment confirmation')}
${paragraph(
  'We received a payment of {{payload.amount}} {{payload.currency}} for order {{#if payload.orderNumber}}#{{payload.orderNumber}}{{else}}#{{payload.orderId}}{{/if}} on {{payload.processedAt}} ({{payload.status}}).',
)}
${dataTable(`
  ${tableRow('Method', '{{payload.method}}')}
  ${tableRow('Reference', '{{#if payload.paymentId}}#{{payload.paymentId}}{{else}}-{{/if}}')}
`)}
{{#if payload.portalUrl}}
  ${buildButton('{{payload.portalUrl}}', 'View payment details')}
{{/if}}
${paragraph('Keep this receipt for your records.', styles.muted)}
`)

const paymentCustomerEs = wrapWithLayout(`
${heading('Confirmación de pago')}
${paragraph(
  'Recibimos un pago de {{payload.amount}} {{payload.currency}} para el pedido {{#if payload.orderNumber}}#{{payload.orderNumber}}{{else}}#{{payload.orderId}}{{/if}} el {{payload.processedAt}} ({{payload.status}}).',
)}
${dataTable(`
  ${tableRow('Método', '{{payload.method}}')}
  ${tableRow('Referencia', '{{#if payload.paymentId}}#{{payload.paymentId}}{{else}}-{{/if}}')}
`)}
{{#if payload.portalUrl}}
  ${buildButton('{{payload.portalUrl}}', 'Ver detalle del pago')}
{{/if}}
${paragraph('Guardá este comprobante para tus registros.', styles.muted)}
`)

const paymentAdminEn = wrapWithLayout(`
${heading('Payment received')}
${paragraph(
  'Payment {{payload.amount}} {{payload.currency}} for order {{#if payload.orderNumber}}#{{payload.orderNumber}}{{else}}#{{payload.orderId}}{{/if}} was recorded on {{payload.processedAt}} with status {{payload.status}}.',
)}
${dataTable(`
  ${tableRow('Customer', '{{payload.customer.name}} ({{payload.customer.email}})')}
  ${tableRow('Method', '{{payload.method}}')}
`)}
{{#if payload.portalUrl}}
  ${buildButton('{{payload.portalUrl}}', 'Review payment')}
{{/if}}
`)

const paymentAdminEs = wrapWithLayout(`
${heading('Pago recibido')}
${paragraph(
  'Se registró un pago de {{payload.amount}} {{payload.currency}} para el pedido {{#if payload.orderNumber}}#{{payload.orderNumber}}{{else}}#{{payload.orderId}}{{/if}} el {{payload.processedAt}} con estado {{payload.status}}.',
)}
${dataTable(`
  ${tableRow('Cliente', '{{payload.customer.name}} ({{payload.customer.email}})')}
  ${tableRow('Método', '{{payload.method}}')}
`)}
{{#if payload.portalUrl}}
  ${buildButton('{{payload.portalUrl}}', 'Revisar pago')}
{{/if}}
`)

const resetCustomerEn = wrapWithLayout(`
${heading(
  "{{#if (eq payload.event 'password_changed')}}Your password was updated{{else if (eq payload.event 'recovery_notice')}}Password recovery requested{{else}}Reset your password{{/if}}",
)}
${paragraph(
  "{{#if (eq payload.event 'password_changed')}}Hello {{payload.displayName}}, your password was just updated. If you did not make this change, secure your account immediately.{{else if (eq payload.event 'recovery_notice')}}Hello {{payload.displayName}}, we received a request to recover access to your account. If it was you, follow the steps below. If not, secure your account to keep it safe.{{else}}Hello {{payload.displayName}}, we received a request to reset your password. Use the button below to choose a new one.{{#if payload.expiresAt}} This link expires on {{payload.expiresAt}}.{{/if}}{{/if}}",
)}
{{#if payload.resetUrl}}
  ${buildButton(
    '{{payload.resetUrl}}',
    "{{#if (eq payload.event 'reset_link')}}Reset password{{else}}Secure account{{/if}}",
  )}
{{/if}}
${paragraph(
  "{{#if (eq payload.event 'password_changed')}}If you did not authorize this change, secure your account or contact us immediately.{{else if (eq payload.event 'recovery_notice')}}If this wasn't you, secure your account to prevent unauthorized access.{{else}}Didn't request this? You can safely ignore this email.{{/if}}",
  styles.muted,
)}
`)

const resetCustomerEs = wrapWithLayout(`
${heading(
  "{{#if (eq payload.event 'password_changed')}}Tu contraseña fue actualizada{{else if (eq payload.event 'recovery_notice')}}Solicitud de recuperación{{else}}Restablecé tu contraseña{{/if}}",
)}
${paragraph(
  "{{#if (eq payload.event 'password_changed')}}Hola {{payload.displayName}}, acabamos de actualizar tu contraseña. Si no fuiste vos, asegurá tu cuenta de inmediato.{{else if (eq payload.event 'recovery_notice')}}Hola {{payload.displayName}}, recibimos una solicitud para recuperar el acceso a tu cuenta. Si fuiste vos, seguí los pasos a continuación. Si no la hiciste, protegé tu cuenta.{{else}}Hola {{payload.displayName}}, recibimos una solicitud para restablecer tu contraseña. Utilizá el siguiente botón para crear una nueva.{{#if payload.expiresAt}} El enlace vence el {{payload.expiresAt}}.{{/if}}{{/if}}",
)}
{{#if payload.resetUrl}}
  ${buildButton(
    '{{payload.resetUrl}}',
    "{{#if (eq payload.event 'reset_link')}}Restablecer contraseña{{else}}Proteger cuenta{{/if}}",
  )}
{{/if}}
${paragraph(
  "{{#if (eq payload.event 'password_changed')}}Si no realizaste este cambio, asegurá tu cuenta o contactanos de inmediato.{{else if (eq payload.event 'recovery_notice')}}Si no fuiste vos, protegé tu cuenta para evitar accesos no autorizados.{{else}}¿No solicitaste esto? Podés ignorar este mensaje.{{/if}}",
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
    version: 6,
    subject: orderCustomerSubjectEn,
    body: orderCustomerEn,
  },
  {
    category: EmailCategory.ORDERS,
    variant: EmailTemplateVariant.CUSTOMER,
    locale: 'es',
    version: 6,
    subject: orderCustomerSubjectEs,
    body: orderCustomerEs,
  },
  {
    category: EmailCategory.ORDERS,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'en',
    version: 6,
    subject: orderAdminSubjectEn,
    body: orderAdminEn,
  },
  {
    category: EmailCategory.ORDERS,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'es',
    version: 6,
    subject: orderAdminSubjectEs,
    body: orderAdminEs,
  },
  {
    category: EmailCategory.PAYMENTS,
    variant: EmailTemplateVariant.CUSTOMER,
    locale: 'en',
    version: 2,
    subject: '[{{companyName}}] Payment received for order #{{payload.orderNumber}}',
    body: paymentCustomerEn,
  },
  {
    category: EmailCategory.PAYMENTS,
    variant: EmailTemplateVariant.CUSTOMER,
    locale: 'es',
    version: 2,
    subject: '[{{companyName}}] Pago recibido para el pedido #{{payload.orderNumber}}',
    body: paymentCustomerEs,
  },
  {
    category: EmailCategory.PAYMENTS,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'en',
    version: 2,
    subject: '[Payments] Payment received for order #{{payload.orderNumber}}',
    body: paymentAdminEn,
  },
  {
    category: EmailCategory.PAYMENTS,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'es',
    version: 2,
    subject: '[Pagos] Pago registrado para el pedido #{{payload.orderNumber}}',
    body: paymentAdminEs,
  },
  {
    category: EmailCategory.AUTH,
    variant: EmailTemplateVariant.CUSTOMER,
    locale: 'en',
    version: 2,
    subject: 'Reset your {{companyName}} password',
    body: resetCustomerEn,
  },
  {
    category: EmailCategory.AUTH,
    variant: EmailTemplateVariant.CUSTOMER,
    locale: 'es',
    version: 2,
    subject: 'Restablecé tu contraseña de {{companyName}}',
    body: resetCustomerEs,
  },
  {
    category: EmailCategory.AUTH,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'en',
    version: 2,
    subject: 'Reset your administrator password',
    body: resetAdminEn,
  },
  {
    category: EmailCategory.AUTH,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'es',
    version: 2,
    subject: 'Restablecer contraseña de administrador',
    body: resetAdminEs,
  },
]
