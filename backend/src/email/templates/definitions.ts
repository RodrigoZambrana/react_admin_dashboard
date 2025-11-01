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
  {{#if (eq payload.documentType 'BUDGET')}}
    {{#if (eq payload.event 'budget.created')}}We prepared quote <span class="pill">#{{payload.orderNumber}}</span> on {{payload.orderDate}}. Review the details below.{{else}}
      {{#if (eq payload.event 'budget.status.sent')}}Your quote is available and ready to share.{{else}}
        {{#if (eq payload.event 'budget.status.accepted')}}Thanks for approving your quote. We will coordinate next steps shortly.{{else}}
          {{#if (eq payload.event 'budget.status.converted')}}Your quote is now an order. We will keep you posted with progress.{{else}}
            {{#if (eq payload.event 'budget.status.expired')}}This quote expired on {{payload.validUntil}}. Contact us if you need an updated version.{{else}}
              {{#if (eq payload.event 'budget.status.cancelled')}}This quote was cancelled as requested. Reach out if you would like to reactivate it.{{else}}
                Here is the latest update for your quote.{{/if}}
              {{/if}}
            {{/if}}
          {{/if}}
        {{/if}}
      {{/if}}
    {{/if}}
  {{else}}
    {{#if (eq payload.event 'order.received')}}We received order <span class="pill">#{{payload.orderNumber}}</span> on {{payload.orderDate}}. We will share updates as it moves forward.{{else}}
      {{#if (eq payload.event 'order.status.paid')}}Your payment was confirmed. We are preparing everything for the next step.{{else}}
        {{#if (eq payload.event 'order.status.delivered')}}Your items have been delivered. Enjoy!{{else}}
          {{#if (eq payload.event 'order.status.cancelled')}}Your order was cancelled. Contact us if we can help further.{{else}}
            Here is the latest update for your order.{{/if}}
          {{/if}}
        {{/if}}
      {{/if}}
    {{/if}}
  {{/if}}
</mj-text>
{{#if payload.status}}
  <mj-text><strong>Current status:</strong> {{payload.status}}</mj-text>
{{/if}}
{{#if payload.deliveryEstimate}}
  <mj-text>
    <strong>Estimated delivery:</strong>
    {{#if payload.deliveryEstimate.minHours}}{{payload.deliveryEstimate.minHours}}h{{/if}}
    {{#if (and payload.deliveryEstimate.minHours payload.deliveryEstimate.maxHours)}} – {{/if}}
    {{#if payload.deliveryEstimate.maxHours}}{{payload.deliveryEstimate.maxHours}}h{{/if}}
  </mj-text>
{{/if}}
{{#if payload.validUntil}}
  <mj-text><strong>Valid until:</strong> {{payload.validUntil}}</mj-text>
{{/if}}
${orderItemsTableEn}
${totalsBlockEn}
{{#if payload.paymentMethod}}
  <mj-text><strong>Payment method:</strong> {{payload.paymentMethod}}</mj-text>
{{/if}}
${buildCustomerCta('en')}
<mj-text class="muted">
  Need help? Reply to this email or contact us at {{companyFooter}}.
</mj-text>
`)

const orderCustomerEs = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">
  {{#if payload.customer.name}}{{payload.customer.name}}, {{/if}}{{eventLabel payload.event}}!
  {{#if payload.orderNumber}} <span class="pill">#{{payload.orderNumber}}</span>{{/if}}
</mj-text>
<mj-text>
  {{#if (eq payload.documentType 'BUDGET')}}
    {{#if (eq payload.event 'budget.created')}}Preparamos el presupuesto <span class="pill">#{{payload.orderNumber}}</span> el {{payload.orderDate}}. Revisá los detalles a continuación.{{else}}
      {{#if (eq payload.event 'budget.status.sent')}}Tu presupuesto está disponible para compartir.{{else}}
        {{#if (eq payload.event 'budget.status.accepted')}}Gracias por aprobar tu presupuesto. Coordinaremos los próximos pasos a la brevedad.{{else}}
          {{#if (eq payload.event 'budget.status.converted')}}Tu presupuesto ahora es un pedido. Te mantendremos al tanto del progreso.{{else}}
            {{#if (eq payload.event 'budget.status.expired')}}Este presupuesto venció el {{payload.validUntil}}. Contactanos si necesitás una nueva versión.{{else}}
              {{#if (eq payload.event 'budget.status.cancelled')}}Este presupuesto fue cancelado según tu solicitud. Avisanos si querés reactivarlo.{{else}}
                Aquí tenés la última actualización de tu presupuesto.{{/if}}
              {{/if}}
            {{/if}}
          {{/if}}
        {{/if}}
      {{/if}}
    {{/if}}
  {{else}}
    {{#if (eq payload.event 'order.received')}}Recibimos el pedido <span class="pill">#{{payload.orderNumber}}</span> el {{payload.orderDate}}. Te avisaremos a medida que avance.{{else}}
      {{#if (eq payload.event 'order.status.paid')}}Confirmamos tu pago. Estamos preparando todo para el próximo paso.{{else}}
        {{#if (eq payload.event 'order.status.delivered')}}Tu compra ya fue entregada. ¡Gracias por elegirnos!{{else}}
          {{#if (eq payload.event 'order.status.cancelled')}}Tu pedido fue cancelado. Escribinos si podemos ayudarte.{{else}}
            Te compartimos la última actualización de tu pedido.{{/if}}
          {{/if}}
        {{/if}}
      {{/if}}
    {{/if}}
  {{/if}}
</mj-text>
{{#if payload.status}}
  <mj-text><strong>Estado actual:</strong> {{payload.status}}</mj-text>
{{/if}}
{{#if payload.deliveryEstimate}}
  <mj-text>
    <strong>Entrega estimada:</strong>
    {{#if payload.deliveryEstimate.minHours}}{{payload.deliveryEstimate.minHours}}h{{/if}}
    {{#if (and payload.deliveryEstimate.minHours payload.deliveryEstimate.maxHours)}} – {{/if}}
    {{#if payload.deliveryEstimate.maxHours}}{{payload.deliveryEstimate.maxHours}}h{{/if}}
  </mj-text>
{{/if}}
{{#if payload.validUntil}}
  <mj-text><strong>Válido hasta:</strong> {{payload.validUntil}}</mj-text>
{{/if}}
${orderItemsTableEs}
${totalsBlockEs}
{{#if payload.paymentMethod}}
  <mj-text><strong>Método de pago:</strong> {{payload.paymentMethod}}</mj-text>
{{/if}}
${buildCustomerCta('es')}
<mj-text class="muted">
  ¿Necesitás ayuda? Respondé este correo o escribinos a {{companyFooter}}.
</mj-text>
`)

const orderAdminEn = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">
  {{eventLabel payload.event}}
  {{#if payload.orderNumber}} <span class="pill">#{{payload.orderNumber}}</span>{{/if}}
</mj-text>
<mj-text>
  {{#if (eq payload.documentType 'BUDGET')}}
    {{#if (eq payload.event 'budget.created')}}New quote created by {{default payload.customer.name payload.customer.email}} on {{payload.orderDate}}.{{else}}
      {{#if (eq payload.event 'budget.status.sent')}}Quote shared with customer.{{else}}
        {{#if (eq payload.event 'budget.status.accepted')}}Customer approved the quote. Review next steps.{{else}}
          {{#if (eq payload.event 'budget.status.converted')}}Quote converted to order. Monitor fulfillment progress.{{else}}
            {{#if (eq payload.event 'budget.status.expired')}}Quote expired on {{payload.validUntil}}.{{else}}
              {{#if (eq payload.event 'budget.status.cancelled')}}Quote cancelled per customer request.{{else}}
                Quote update for follow-up.{{/if}}
              {{/if}}
            {{/if}}
          {{/if}}
        {{/if}}
      {{/if}}
    {{/if}}
  {{else}}
    {{#if (eq payload.event 'order.received')}}New order placed by {{default payload.customer.name payload.customer.email}} on {{payload.orderDate}}.{{else}}
      {{#if (eq payload.event 'order.status.paid')}}Order marked as paid. Confirm logistics or invoicing.{{else}}
        {{#if (eq payload.event 'order.status.delivered')}}Order delivered. Close out outstanding tasks.{{else}}
          {{#if (eq payload.event 'order.status.cancelled')}}Order cancelled. Review inventory or refund actions.{{else}}
            Order status updated.{{/if}}
          {{/if}}
        {{/if}}
      {{/if}}
    {{/if}}
  {{/if}}
</mj-text>
<mj-table>
  <tr>
    <td align="left"><strong>Customer</strong></td>
    <td align="right">{{default payload.customer.name payload.customer.email}} ({{payload.customer.email}})</td>
  </tr>
  {{#if payload.status}}
  <tr>
    <td align="left"><strong>Status</strong></td>
    <td align="right">{{payload.status}}</td>
  </tr>
  {{/if}}
  {{#if payload.previousStatus}}
  <tr>
    <td align="left"><strong>Previous status</strong></td>
    <td align="right">{{payload.previousStatus}}</td>
  </tr>
  {{/if}}
  {{#if payload.paymentMethod}}
  <tr>
    <td align="left"><strong>Payment</strong></td>
    <td align="right">{{payload.paymentMethod}}</td>
  </tr>
  {{/if}}
  {{#if payload.validUntil}}
  <tr>
    <td align="left"><strong>Valid until</strong></td>
    <td align="right">{{payload.validUntil}}</td>
  </tr>
  {{/if}}
</mj-table>
${orderItemsTableEn}
${totalsBlockEn}
{{#if payload.notes}}
  <mj-text><strong>Notes:</strong> {{payload.notes}}</mj-text>
{{/if}}
${buildAdminCta('en')}
<mj-text class="muted">Automated notification generated by the system.</mj-text>
`)

const orderAdminEs = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">
  {{eventLabel payload.event}}
  {{#if payload.orderNumber}} <span class="pill">#{{payload.orderNumber}}</span>{{/if}}
</mj-text>
<mj-text>
  {{#if (eq payload.documentType 'BUDGET')}}
    {{#if (eq payload.event 'budget.created')}}Nuevo presupuesto creado por {{default payload.customer.name payload.customer.email}} el {{payload.orderDate}}.{{else}}
      {{#if (eq payload.event 'budget.status.sent')}}Presupuesto enviado al cliente.{{else}}
        {{#if (eq payload.event 'budget.status.accepted')}}El cliente aprobó el presupuesto. Revisá los próximos pasos.{{else}}
          {{#if (eq payload.event 'budget.status.converted')}}El presupuesto se convirtió en pedido. Supervisá la ejecución.{{else}}
            {{#if (eq payload.event 'budget.status.expired')}}El presupuesto venció el {{payload.validUntil}}.{{else}}
              {{#if (eq payload.event 'budget.status.cancelled')}}El presupuesto fue cancelado por el cliente.{{else}}
                Actualización de presupuesto para seguimiento.{{/if}}
              {{/if}}
            {{/if}}
          {{/if}}
        {{/if}}
      {{/if}}
    {{/if}}
  {{else}}
    {{#if (eq payload.event 'order.received')}}Nuevo pedido ingresado por {{default payload.customer.name payload.customer.email}} el {{payload.orderDate}}.{{else}}
      {{#if (eq payload.event 'order.status.paid')}}Pedido marcado como pagado. Confirmá logística o facturación.{{else}}
        {{#if (eq payload.event 'order.status.delivered')}}Pedido entregado. Cerrá las tareas pendientes.{{else}}
          {{#if (eq payload.event 'order.status.cancelled')}}Pedido cancelado. Revisá inventario o devoluciones.{{else}}
            Actualización de estado del pedido.{{/if}}
          {{/if}}
        {{/if}}
      {{/if}}
    {{/if}}
  {{/if}}
</mj-text>
<mj-table>
  <tr>
    <td align="left"><strong>Cliente</strong></td>
    <td align="right">{{default payload.customer.name payload.customer.email}} ({{payload.customer.email}})</td>
  </tr>
  {{#if payload.status}}
  <tr>
    <td align="left"><strong>Estado</strong></td>
    <td align="right">{{payload.status}}</td>
  </tr>
  {{/if}}
  {{#if payload.previousStatus}}
  <tr>
    <td align="left"><strong>Estado anterior</strong></td>
    <td align="right">{{payload.previousStatus}}</td>
  </tr>
  {{/if}}
  {{#if payload.paymentMethod}}
  <tr>
    <td align="left"><strong>Pago</strong></td>
    <td align="right">{{payload.paymentMethod}}</td>
  </tr>
  {{/if}}
  {{#if payload.validUntil}}
  <tr>
    <td align="left"><strong>Válido hasta</strong></td>
    <td align="right">{{payload.validUntil}}</td>
  </tr>
  {{/if}}
</mj-table>
${orderItemsTableEs}
${totalsBlockEs}
{{#if payload.notes}}
  <mj-text><strong>Notas:</strong> {{payload.notes}}</mj-text>
{{/if}}
${buildAdminCta('es')}
<mj-text class="muted">Notificación automática generada por el sistema.</mj-text>
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
<mj-text class="muted">Keep this receipt for your records.</mj-text>
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
<mj-text class="muted">Guardá este comprobante para tus registros.</mj-text>
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
<mj-text class="muted">
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
<mj-text class="muted">
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
<mj-text class="muted">
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
<mj-text class="muted">
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
    version: 2,
    subject: orderCustomerSubjectEn,
    body: orderCustomerEn,
  },
  {
    category: EmailCategory.ORDERS,
    variant: EmailTemplateVariant.CUSTOMER,
    locale: 'es',
    version: 2,
    subject: orderCustomerSubjectEs,
    body: orderCustomerEs,
  },
  {
    category: EmailCategory.ORDERS,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'en',
    version: 2,
    subject: orderAdminSubjectEn,
    body: orderAdminEn,
  },
  {
    category: EmailCategory.ORDERS,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'es',
    version: 2,
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
