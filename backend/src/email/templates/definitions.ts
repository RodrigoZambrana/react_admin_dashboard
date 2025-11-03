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

const buildOrderItemsTable = (labels: { item: string; qty: string; amount: string }) => `
<mj-table>
  <tr class="table-header">
    <th align="left">${labels.item}</th>
    <th align="center">${labels.qty}</th>
    <th align="right">${labels.amount}</th>
  </tr>
  {{#each payload.items}}
    <tr class="table-row">
      <td>
        <div>{{this.name}}</div>
        {{#if this.description}}
          <div class="muted item-note">{{this.description}}</div>
        {{/if}}
      </td>
      <td align="center">{{this.quantity}}</td>
      <td align="right">{{formatCurrency this.subtotalRaw ../payload.totals.currency}}</td>
    </tr>
  {{/each}}
</mj-table>
`

const buildTotalsBlock = (labels: { subtotal: string; tax: string; total: string }) => `
<mj-divider padding="12px 0" border-color="#E5E7EB" />
<mj-table>
  <tr>
    <td align="left"><strong>${labels.subtotal}</strong></td>
    <td align="right">{{formatCurrency payload.totals.subtotalRaw payload.totals.currency}}</td>
  </tr>
  {{#if payload.totals.taxRaw}}
  <tr>
    <td align="left"><strong>${labels.tax}</strong></td>
    <td align="right">{{formatCurrency payload.totals.taxRaw payload.totals.currency}}</td>
  </tr>
  {{/if}}
  <tr>
    <td align="left"><strong>${labels.total}</strong></td>
    <td align="right">{{formatCurrency payload.totals.grandTotalRaw payload.totals.currency}}</td>
  </tr>
</mj-table>
`

const buildCustomerCta = (locale: 'en' | 'es') => {
  const labels = locale === 'en'
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
      <mj-button href="{{default (default payload.links.customer payload.portalUrl) '#'}}">${labels.review}</mj-button>
    {{else}}
      {{#if (eq payload.event 'budget.status.accepted')}}
        <mj-button href="{{default (default payload.links.customer payload.portalUrl) '#'}}">${labels.confirm}</mj-button>
      {{else}}
        <mj-button href="{{default (default payload.links.customer payload.portalUrl) '#'}}">${labels.openQuote}</mj-button>
      {{/if}}
    {{/if}}
  {{else}}
    {{#if (eq payload.event 'order.received')}}
      <mj-button href="{{default (default payload.links.customer payload.portalUrl) '#'}}">${labels.viewOrder}</mj-button>
    {{else}}
      {{#if (eq payload.event 'order.status.delivered')}}
        <mj-button href="{{default (default payload.links.customer payload.portalUrl) '#'}}">${labels.feedback}</mj-button>
      {{else}}
        <mj-button href="{{default (default payload.links.customer payload.portalUrl) '#'}}">${labels.track}</mj-button>
      {{/if}}
    {{/if}}
  {{/if}}
{{/if}}
`
}

const buildAdminCta = (locale: 'en' | 'es') => `
{{#if (or payload.links.admin payload.adminUrl)}}
  <mj-button href="{{default (default payload.links.admin payload.adminUrl) '#'}}">${locale === 'en' ? 'Open in dashboard' : 'Abrir en panel'}</mj-button>
{{/if}}
`

const orderItemsTableEn = buildOrderItemsTable({ item: 'Item', qty: 'Qty', amount: 'Amount' })
const orderItemsTableEs = buildOrderItemsTable({ item: 'Producto', qty: 'Cant.', amount: 'Importe' })
const totalsBlockEn = buildTotalsBlock({ subtotal: 'Subtotal', tax: 'Tax', total: 'Total' })
const totalsBlockEs = buildTotalsBlock({ subtotal: 'Subtotal', tax: 'Impuestos', total: 'Total' })

const orderCustomerSubjectEn = `[{{companyName}}] {{eventLabel payload.event}} {{#if payload.orderNumber}}#{{payload.orderNumber}}{{/if}}`
const orderCustomerSubjectEs = `[{{companyName}}] {{eventLabel payload.event}} {{#if payload.orderNumber}}#{{payload.orderNumber}}{{/if}}`
const orderAdminSubjectEn = `[{{companyName}} - Admin] {{eventLabel payload.event}} {{#if payload.orderNumber}}#{{payload.orderNumber}}{{/if}}`
const orderAdminSubjectEs = `[{{companyName}} - Admin] {{eventLabel payload.event}} {{#if payload.orderNumber}}#{{payload.orderNumber}}{{/if}}`

const orderCustomerEn = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">
  {{#if payload.customer.name}}{{payload.customer.name}}, {{/if}}{{eventLabel payload.event}}!
  {{#if payload.orderNumber}} <span class="pill">#{{payload.orderNumber}}</span>{{/if}}
</mj-text>
<mj-text>
  {{eventMessage payload}}
</mj-text>
<mj-table>
  <tr>
    <td><strong>Order number</strong></td>
    <td align="right">{{default payload.orderNumber payload.orderId}}</td>
  </tr>
  <tr>
    <td><strong>Order date</strong></td>
    <td align="right">{{payload.orderDate}}</td>
  </tr>
  {{#if payload.status}}
  <tr>
    <td><strong>Current status</strong></td>
    <td align="right">{{payload.status}}</td>
  </tr>
  {{/if}}
  <tr>
    <td><strong>Total</strong></td>
    <td align="right">{{formatCurrency payload.totals.grandTotalRaw payload.totals.currency}}</td>
  </tr>
  {{#if payload.paymentMethod}}
  <tr>
    <td><strong>Payment method</strong></td>
    <td align="right">{{payload.paymentMethod}}</td>
  </tr>
  {{/if}}
  {{#if payload.deliveryEstimate}}
  <tr>
    <td><strong>Estimated delivery</strong></td>
    <td align="right">
      {{#if payload.deliveryEstimate.minHours}}{{payload.deliveryEstimate.minHours}}h{{/if}}
      {{#if (and payload.deliveryEstimate.minHours payload.deliveryEstimate.maxHours)}} – {{/if}}
      {{#if payload.deliveryEstimate.maxHours}}{{payload.deliveryEstimate.maxHours}}h{{/if}}
    </td>
  </tr>
  {{/if}}
  {{#if payload.validUntil}}
  <tr>
    <td><strong>Valid until</strong></td>
    <td align="right">{{payload.validUntil}}</td>
  </tr>
  {{/if}}
</mj-table>
<mj-divider padding="12px 0" border-color="#E5E7EB" />
<mj-text font-size="16px" font-weight="600">Order summary</mj-text>
${orderItemsTableEn}
${totalsBlockEn}
{{#if payload.notes}}
  <mj-divider padding="12px 0" border-color="#E5E7EB" />
  <mj-text><strong>Notes:</strong> {{payload.notes}}</mj-text>
{{/if}}
<mj-divider padding="12px 0" border-color="#E5E7EB" />
${buildCustomerCta('en')}
<mj-text css-class="muted">
  Need help? Reply to this email or contact us at {{companyFooter}}.
</mj-text>
`)

const orderCustomerEs = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">
  {{#if payload.customer.name}}{{payload.customer.name}}, {{/if}}{{eventLabel payload.event}}!
  {{#if payload.orderNumber}} <span class="pill">#{{payload.orderNumber}}</span>{{/if}}
</mj-text>
<mj-text>
  {{eventMessage payload}}
</mj-text>
<mj-table>
  <tr>
    <td><strong>Número de pedido</strong></td>
    <td align="right">{{default payload.orderNumber payload.orderId}}</td>
  </tr>
  <tr>
    <td><strong>Fecha del pedido</strong></td>
    <td align="right">{{payload.orderDate}}</td>
  </tr>
  {{#if payload.status}}
  <tr>
    <td><strong>Estado actual</strong></td>
    <td align="right">{{payload.status}}</td>
  </tr>
  {{/if}}
  <tr>
    <td><strong>Total</strong></td>
    <td align="right">{{formatCurrency payload.totals.grandTotalRaw payload.totals.currency}}</td>
  </tr>
  {{#if payload.paymentMethod}}
  <tr>
    <td><strong>Método de pago</strong></td>
    <td align="right">{{payload.paymentMethod}}</td>
  </tr>
  {{/if}}
  {{#if payload.deliveryEstimate}}
  <tr>
    <td><strong>Entrega estimada</strong></td>
    <td align="right">
      {{#if payload.deliveryEstimate.minHours}}{{payload.deliveryEstimate.minHours}}h{{/if}}
      {{#if (and payload.deliveryEstimate.minHours payload.deliveryEstimate.maxHours)}} – {{/if}}
      {{#if payload.deliveryEstimate.maxHours}}{{payload.deliveryEstimate.maxHours}}h{{/if}}
    </td>
  </tr>
  {{/if}}
  {{#if payload.validUntil}}
  <tr>
    <td><strong>Válido hasta</strong></td>
    <td align="right">{{payload.validUntil}}</td>
  </tr>
  {{/if}}
</mj-table>
<mj-divider padding="12px 0" border-color="#E5E7EB" />
<mj-text font-size="16px" font-weight="600">Resumen del pedido</mj-text>
${orderItemsTableEs}
${totalsBlockEs}
{{#if payload.notes}}
  <mj-divider padding="12px 0" border-color="#E5E7EB" />
  <mj-text><strong>Notas:</strong> {{payload.notes}}</mj-text>
{{/if}}
<mj-divider padding="12px 0" border-color="#E5E7EB" />
${buildCustomerCta('es')}
<mj-text css-class="muted">
  ¿Necesitás ayuda? Respondé este correo o escribinos a {{companyFooter}}.
</mj-text>
`)

const orderAdminEn = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">
  {{eventLabel payload.event}}
  {{#if payload.orderNumber}} <span class="pill">#{{payload.orderNumber}}</span>{{/if}}
</mj-text>
<mj-text>
  {{eventAdminMessage payload}}
</mj-text>
<mj-table>
  <tr>
    <td><strong>Order number</strong></td>
    <td align="right">{{default payload.orderNumber payload.orderId}}</td>
  </tr>
  <tr>
    <td><strong>Customer</strong></td>
    <td align="right">{{default payload.customer.name payload.customer.email}} ({{payload.customer.email}})</td>
  </tr>
  <tr>
    <td><strong>Order date</strong></td>
    <td align="right">{{payload.orderDate}}</td>
  </tr>
  {{#if payload.status}}
  <tr>
    <td><strong>Status</strong></td>
    <td align="right">{{payload.status}}</td>
  </tr>
  {{/if}}
  {{#if payload.previousStatus}}
  <tr>
    <td><strong>Previous status</strong></td>
    <td align="right">{{payload.previousStatus}}</td>
  </tr>
  {{/if}}
  <tr>
    <td><strong>Total</strong></td>
    <td align="right">{{formatCurrency payload.totals.grandTotalRaw payload.totals.currency}}</td>
  </tr>
  {{#if payload.paymentMethod}}
  <tr>
    <td><strong>Payment method</strong></td>
    <td align="right">{{payload.paymentMethod}}</td>
  </tr>
  {{/if}}
</mj-table>
<mj-divider padding="12px 0" border-color="#E5E7EB" />
<mj-text font-size="16px" font-weight="600">Order summary</mj-text>
${orderItemsTableEn}
${totalsBlockEn}
{{#if payload.notes}}
  <mj-divider padding="12px 0" border-color="#E5E7EB" />
  <mj-text><strong>Notes:</strong> {{payload.notes}}</mj-text>
{{/if}}
<mj-divider padding="12px 0" border-color="#E5E7EB" />
${buildAdminCta('en')}
<mj-text css-class="muted">Automated notification generated by the system.</mj-text>
`)

const orderAdminEs = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">
  {{eventLabel payload.event}}
  {{#if payload.orderNumber}} <span class="pill">#{{payload.orderNumber}}</span>{{/if}}
</mj-text>
<mj-text>
  {{eventAdminMessage payload}}
</mj-text>
<mj-table>
  <tr>
    <td><strong>Número de pedido</strong></td>
    <td align="right">{{default payload.orderNumber payload.orderId}}</td>
  </tr>
  <tr>
    <td><strong>Cliente</strong></td>
    <td align="right">{{default payload.customer.name payload.customer.email}} ({{payload.customer.email}})</td>
  </tr>
  <tr>
    <td><strong>Fecha del pedido</strong></td>
    <td align="right">{{payload.orderDate}}</td>
  </tr>
  {{#if payload.status}}
  <tr>
    <td><strong>Estado</strong></td>
    <td align="right">{{payload.status}}</td>
  </tr>
  {{/if}}
  {{#if payload.previousStatus}}
  <tr>
    <td><strong>Estado anterior</strong></td>
    <td align="right">{{payload.previousStatus}}</td>
  </tr>
  {{/if}}
  <tr>
    <td><strong>Total</strong></td>
    <td align="right">{{formatCurrency payload.totals.grandTotalRaw payload.totals.currency}}</td>
  </tr>
  {{#if payload.paymentMethod}}
  <tr>
    <td><strong>Método de pago</strong></td>
    <td align="right">{{payload.paymentMethod}}</td>
  </tr>
  {{/if}}
</mj-table>
<mj-divider padding="12px 0" border-color="#E5E7EB" />
<mj-text font-size="16px" font-weight="600">Resumen del pedido</mj-text>
${orderItemsTableEs}
${totalsBlockEs}
{{#if payload.notes}}
  <mj-divider padding="12px 0" border-color="#E5E7EB" />
  <mj-text><strong>Notas:</strong> {{payload.notes}}</mj-text>
{{/if}}
<mj-divider padding="12px 0" border-color="#E5E7EB" />
${buildAdminCta('es')}
<mj-text css-class="muted">Notificación automática generada por el sistema.</mj-text>
`)

const paymentCustomerEn = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">Payment confirmation</mj-text>
<mj-text>
  We received a payment of {{payload.amount}} {{payload.currency}} for order {{#if payload.orderNumber}}#{{payload.orderNumber}}{{else}}#{{payload.orderId}}{{/if}} on {{payload.processedAt}} ({{payload.status}}).
</mj-text>
<mj-table>
  <tr>
    <td align="left"><strong>Method</strong></td>
    <td align="right">{{payload.method}}</td>
  </tr>
  <tr>
    <td align="left"><strong>Reference</strong></td>
    <td align="right">{{#if payload.paymentId}}#{{payload.paymentId}}{{else}}-{{/if}}</td>
  </tr>
</mj-table>
{{#if payload.portalUrl}}
  <mj-button href="{{payload.portalUrl}}">View payment details</mj-button>
{{/if}}
<mj-text css-class="muted">Keep this receipt for your records.</mj-text>
`)

const paymentCustomerEs = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">Confirmación de pago</mj-text>
<mj-text>
  Recibimos un pago de {{payload.amount}} {{payload.currency}} para el pedido {{#if payload.orderNumber}}#{{payload.orderNumber}}{{else}}#{{payload.orderId}}{{/if}} el {{payload.processedAt}} ({{payload.status}}).
</mj-text>
<mj-table>
  <tr>
    <td align="left"><strong>Método</strong></td>
    <td align="right">{{payload.method}}</td>
  </tr>
  <tr>
    <td align="left"><strong>Referencia</strong></td>
    <td align="right">{{#if payload.paymentId}}#{{payload.paymentId}}{{else}}-{{/if}}</td>
  </tr>
</mj-table>
{{#if payload.portalUrl}}
  <mj-button href="{{payload.portalUrl}}">Ver detalle del pago</mj-button>
{{/if}}
<mj-text css-class="muted">Guardá este comprobante para tus registros.</mj-text>
`)

const paymentAdminEn = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">Payment received</mj-text>
<mj-text>
  Payment {{payload.amount}} {{payload.currency}} for order {{#if payload.orderNumber}}#{{payload.orderNumber}}{{else}}#{{payload.orderId}}{{/if}} was recorded on {{payload.processedAt}} with status {{payload.status}}.
</mj-text>
<mj-table>
  <tr>
    <td align="left"><strong>Customer</strong></td>
    <td align="right">{{payload.customer.name}} ({{payload.customer.email}})</td>
  </tr>
  <tr>
    <td align="left"><strong>Method</strong></td>
    <td align="right">{{payload.method}}</td>
  </tr>
</mj-table>
{{#if payload.portalUrl}}
  <mj-button href="{{payload.portalUrl}}">Review payment</mj-button>
{{/if}}
`)

const paymentAdminEs = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">Pago recibido</mj-text>
<mj-text>
  Se registró un pago de {{payload.amount}} {{payload.currency}} para el pedido {{#if payload.orderNumber}}#{{payload.orderNumber}}{{else}}#{{payload.orderId}}{{/if}} el {{payload.processedAt}} con estado {{payload.status}}.
</mj-text>
<mj-table>
  <tr>
    <td align="left"><strong>Cliente</strong></td>
    <td align="right">{{payload.customer.name}} ({{payload.customer.email}})</td>
  </tr>
  <tr>
    <td align="left"><strong>Método</strong></td>
    <td align="right">{{payload.method}}</td>
  </tr>
</mj-table>
{{#if payload.portalUrl}}
  <mj-button href="{{payload.portalUrl}}">Revisar pago</mj-button>
{{/if}}
`)

const resetCustomerEn = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">
  {{#if (eq payload.event 'password_changed')}}Your password was updated{{else if (eq payload.event 'recovery_notice')}}Password recovery requested{{else}}Reset your password{{/if}}
</mj-text>
<mj-text>
  {{#if (eq payload.event 'password_changed')}}
    Hello {{payload.displayName}}, your password was just updated. If you did not make this change, secure your account immediately.
  {{else if (eq payload.event 'recovery_notice')}}
    Hello {{payload.displayName}}, we received a request to recover access to your account. If it was you, follow the steps below. If not, secure your account to keep it safe.
  {{else}}
    Hello {{payload.displayName}}, we received a request to reset your password. Use the button below to choose a new one.
    {{#if payload.expiresAt}} This link expires on {{payload.expiresAt}}.{{/if}}
  {{/if}}
</mj-text>
{{#if payload.resetUrl}}
  <mj-button href="{{payload.resetUrl}}">
    {{#if (eq payload.event 'reset_link')}}Reset password{{else}}Secure account{{/if}}
  </mj-button>
{{/if}}
<mj-text css-class="muted">
  {{#if (eq payload.event 'password_changed')}}
    If you did not authorize this change, secure your account or contact us immediately.
  {{else if (eq payload.event 'recovery_notice')}}
    If this wasn&apos;t you, secure your account to prevent unauthorized access.
  {{else}}
    Didn&apos;t request this? You can safely ignore this email.
  {{/if}}
</mj-text>
`)

const resetCustomerEs = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">
  {{#if (eq payload.event 'password_changed')}}Tu contraseña fue actualizada{{else if (eq payload.event 'recovery_notice')}}Solicitud de recuperación{{else}}Restablecé tu contraseña{{/if}}
</mj-text>
<mj-text>
  {{#if (eq payload.event 'password_changed')}}
    Hola {{payload.displayName}}, acabamos de actualizar tu contraseña. Si no fuiste vos, asegurá tu cuenta de inmediato.
  {{else if (eq payload.event 'recovery_notice')}}
    Hola {{payload.displayName}}, recibimos una solicitud para recuperar el acceso a tu cuenta. Si fuiste vos, seguí los pasos a continuación. Si no la hiciste, protegé tu cuenta.
  {{else}}
    Hola {{payload.displayName}}, recibimos una solicitud para restablecer tu contraseña. Utilizá el siguiente botón para crear una nueva.
    {{#if payload.expiresAt}} El enlace vence el {{payload.expiresAt}}.{{/if}}
  {{/if}}
</mj-text>
{{#if payload.resetUrl}}
  <mj-button href="{{payload.resetUrl}}">
    {{#if (eq payload.event 'reset_link')}}Restablecer contraseña{{else}}Proteger cuenta{{/if}}
  </mj-button>
{{/if}}
<mj-text css-class="muted">
  {{#if (eq payload.event 'password_changed')}}
    Si no realizaste este cambio, asegurá tu cuenta o contactanos de inmediato.
  {{else if (eq payload.event 'recovery_notice')}}
    Si no fuiste vos, protegé tu cuenta para evitar accesos no autorizados.
  {{else}}
    ¿No solicitaste esto? Podés ignorar este mensaje.
  {{/if}}
</mj-text>
`)

const resetAdminEn = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">
  {{#if (eq payload.event 'password_changed')}}Administrator password updated{{else if (eq payload.event 'recovery_notice')}}Administrator recovery requested{{else}}Admin password reset{{/if}}
</mj-text>
<mj-text>
  {{#if (eq payload.event 'password_changed')}}
    Hi {{payload.displayName}}, your administrator password was updated. If you didn&apos;t authorize this change, secure your account and alert the security team.
  {{else if (eq payload.event 'recovery_notice')}}
    Hi {{payload.displayName}}, we received a request to recover your administrator account. If this wasn&apos;t you, secure your account immediately.
  {{else}}
    Hi {{payload.displayName}}, you requested to reset your administrator password. Click the button below to continue.
    {{#if payload.expiresAt}} The link expires on {{payload.expiresAt}}.{{/if}}
  {{/if}}
</mj-text>
{{#if payload.resetUrl}}
  <mj-button href="{{payload.resetUrl}}">
    {{#if (eq payload.event 'reset_link')}}Reset administrator password{{else}}Secure administrator account{{/if}}
  </mj-button>
{{/if}}
<mj-text css-class="muted">
  {{#if (eq payload.event 'reset_link')}}
    If you no longer need this, you can safely ignore this email.
  {{else}}
    If this wasn&apos;t you, contact an administrator immediately.
  {{/if}}
</mj-text>
`)

const resetAdminEs = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">
  {{#if (eq payload.event 'password_changed')}}Contraseña de administrador actualizada{{else if (eq payload.event 'recovery_notice')}}Solicitud de recuperación de administrador{{else}}Restablecer contraseña de administrador{{/if}}
</mj-text>
<mj-text>
  {{#if (eq payload.event 'password_changed')}}
    Hola {{payload.displayName}}, tu contraseña de administrador fue actualizada. Si no fuiste vos, asegurá la cuenta y avisá al equipo de seguridad.
  {{else if (eq payload.event 'recovery_notice')}}
    Hola {{payload.displayName}}, recibimos una solicitud para recuperar tu cuenta de administrador. Si no la hiciste, protegé tu cuenta de inmediato.
  {{else}}
    Hola {{payload.displayName}}, solicitaste restablecer tu contraseña de administrador. Hacé clic en el botón para continuar.
    {{#if payload.expiresAt}} El enlace vence el {{payload.expiresAt}}.{{/if}}
  {{/if}}
</mj-text>
{{#if payload.resetUrl}}
  <mj-button href="{{payload.resetUrl}}">
    {{#if (eq payload.event 'reset_link')}}Restablecer contraseña{{else}}Proteger cuenta de administrador{{/if}}
  </mj-button>
{{/if}}
<mj-text css-class="muted">
  {{#if (eq payload.event 'reset_link')}}
    Si ya no necesitás esta acción, podés ignorar este mensaje.
  {{else}}
    Si no fuiste vos, contactá a un administrador de inmediato.
  {{/if}}
</mj-text>
`)

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    category: EmailCategory.ORDERS,
    variant: EmailTemplateVariant.CUSTOMER,
    locale: 'en',
    version: 4,
    subject: orderCustomerSubjectEn,
    body: orderCustomerEn,
  },
  {
    category: EmailCategory.ORDERS,
    variant: EmailTemplateVariant.CUSTOMER,
    locale: 'es',
    version: 4,
    subject: orderCustomerSubjectEs,
    body: orderCustomerEs,
  },
  {
    category: EmailCategory.ORDERS,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'en',
    version: 4,
    subject: orderAdminSubjectEn,
    body: orderAdminEn,
  },
  {
    category: EmailCategory.ORDERS,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'es',
    version: 4,
    subject: orderAdminSubjectEs,
    body: orderAdminEs,
  },
  {
    category: EmailCategory.PAYMENTS,
    variant: EmailTemplateVariant.CUSTOMER,
    locale: 'en',
    version: 1,
    subject: '[{{companyName}}] Payment received for order #{{payload.orderNumber}}',
    body: paymentCustomerEn,
  },
  {
    category: EmailCategory.PAYMENTS,
    variant: EmailTemplateVariant.CUSTOMER,
    locale: 'es',
    version: 1,
    subject: '[{{companyName}}] Pago recibido para el pedido #{{payload.orderNumber}}',
    body: paymentCustomerEs,
  },
  {
    category: EmailCategory.PAYMENTS,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'en',
    version: 1,
    subject: '[Payments] Payment received for order #{{payload.orderNumber}}',
    body: paymentAdminEn,
  },
  {
    category: EmailCategory.PAYMENTS,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'es',
    version: 1,
    subject: '[Pagos] Pago registrado para el pedido #{{payload.orderNumber}}',
    body: paymentAdminEs,
  },
  {
    category: EmailCategory.AUTH,
    variant: EmailTemplateVariant.CUSTOMER,
    locale: 'en',
    version: 1,
    subject: 'Reset your {{companyName}} password',
    body: resetCustomerEn,
  },
  {
    category: EmailCategory.AUTH,
    variant: EmailTemplateVariant.CUSTOMER,
    locale: 'es',
    version: 1,
    subject: 'Restablecé tu contraseña de {{companyName}}',
    body: resetCustomerEs,
  },
  {
    category: EmailCategory.AUTH,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'en',
    version: 1,
    subject: 'Reset your administrator password',
    body: resetAdminEn,
  },
  {
    category: EmailCategory.AUTH,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'es',
    version: 1,
    subject: 'Restablecer contraseña de administrador',
    body: resetAdminEs,
  },
]
