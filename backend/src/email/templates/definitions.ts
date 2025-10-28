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

const orderItemsTable = `
<mj-table>
  <tr class="table-header">
    <th align="left">{{headerItem}}</th>
    <th align="center">{{headerQty}}</th>
    <th align="right">{{headerPrice}}</th>
  </tr>
  {{#each payload.items}}
    <tr class="table-row">
      <td>{{this.name}}</td>
      <td align="center">{{this.quantity}}</td>
      <td align="right">{{this.subtotal}}</td>
    </tr>
  {{/each}}
</mj-table>
`

const totalsBlock = `
<mj-divider padding="12px 0" border-color="#E5E7EB" />
<mj-table>
  <tr>
    <td align="left"><strong>{{labelSubtotal}}</strong></td>
    <td align="right">{{payload.totals.subtotal}} {{payload.totals.currency}}</td>
  </tr>
  {{#if payload.totals.tax}}
  <tr>
    <td align="left"><strong>{{labelTax}}</strong></td>
    <td align="right">{{payload.totals.tax}} {{payload.totals.currency}}</td>
  </tr>
  {{/if}}
  <tr>
    <td align="left"><strong>{{labelTotal}}</strong></td>
    <td align="right">{{payload.totals.grandTotal}} {{payload.totals.currency}}</td>
  </tr>
</mj-table>
`

const orderCustomerEn = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">Thanks for your order{{#if payload.customer.name}}, {{payload.customer.name}}{{/if}}!</mj-text>
<mj-text>
  Your order <span class="pill">#{{payload.orderNumber}}</span> was received on {{payload.orderDate}}. We&apos;ll notify you when it ships.
</mj-text>
${orderItemsTable
  .replace('{{headerItem}}', 'Item')
  .replace('{{headerQty}}', 'Qty')
  .replace('{{headerPrice}}', 'Amount')}
${totalsBlock
  .replace('{{labelSubtotal}}', 'Subtotal')
  .replace('{{labelTax}}', 'Tax')
  .replace('{{labelTotal}}', 'Total')}
{{#if payload.portalUrl}}
  <mj-button href="{{payload.portalUrl}}">View order status</mj-button>
{{/if}}
<mj-text class="muted">
  Need help? Reply to this email and our team will assist you as soon as possible.
</mj-text>
`)

const orderCustomerEs = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">¡Gracias por tu compra{{#if payload.customer.name}}, {{payload.customer.name}}{{/if}}!</mj-text>
<mj-text>
  Tu pedido <span class="pill">#{{payload.orderNumber}}</span> fue recibido el {{payload.orderDate}}. Te avisaremos cuando esté en camino.
</mj-text>
${orderItemsTable
  .replace('{{headerItem}}', 'Producto')
  .replace('{{headerQty}}', 'Cant.')
  .replace('{{headerPrice}}', 'Importe')}
${totalsBlock
  .replace('{{labelSubtotal}}', 'Subtotal')
  .replace('{{labelTax}}', 'Impuestos')
  .replace('{{labelTotal}}', 'Total')}
{{#if payload.portalUrl}}
  <mj-button href="{{payload.portalUrl}}">Ver estado del pedido</mj-button>
{{/if}}
<mj-text class="muted">
  ¿Necesitas ayuda? Responde este correo y nuestro equipo te asistirá a la brevedad.
</mj-text>
`)

const orderAdminEn = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">New order received</mj-text>
<mj-text>
  Order <span class="pill">#{{payload.orderNumber}}</span> from {{payload.customer.name}} was created on {{payload.orderDate}}.
</mj-text>
${orderItemsTable
  .replace('{{headerItem}}', 'Item')
  .replace('{{headerQty}}', 'Qty')
  .replace('{{headerPrice}}', 'Amount')}
${totalsBlock
  .replace('{{labelSubtotal}}', 'Subtotal')
  .replace('{{labelTax}}', 'Tax')
  .replace('{{labelTotal}}', 'Total')}
{{#if payload.portalUrl}}
  <mj-button href="{{payload.portalUrl}}">View in dashboard</mj-button>
{{/if}}
`)

const orderAdminEs = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">Nuevo pedido recibido</mj-text>
<mj-text>
  El pedido <span class="pill">#{{payload.orderNumber}}</span> de {{payload.customer.name}} fue creado el {{payload.orderDate}}.
</mj-text>
${orderItemsTable
  .replace('{{headerItem}}', 'Producto')
  .replace('{{headerQty}}', 'Cant.')
  .replace('{{headerPrice}}', 'Importe')}
${totalsBlock
  .replace('{{labelSubtotal}}', 'Subtotal')
  .replace('{{labelTax}}', 'Impuestos')
  .replace('{{labelTotal}}', 'Total')}
{{#if payload.portalUrl}}
  <mj-button href="{{payload.portalUrl}}">Ver en panel</mj-button>
{{/if}}
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
<mj-text class="muted">Guarda este comprobante para tus registros.</mj-text>
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
<mj-text font-size="18px" font-weight="600">Reset your password</mj-text>
<mj-text>
  Hello {{payload.displayName}}, we received a request to reset your password. Use the button below to choose a new one. This link expires on {{payload.expiresAt}}.
</mj-text>
<mj-button href="{{payload.resetUrl}}">Reset password</mj-button>
<mj-text class="muted">
  Didn&apos;t request this? You can safely ignore this email.
</mj-text>
`)

const resetCustomerEs = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">Restablece tu contraseña</mj-text>
<mj-text>
  Hola {{payload.displayName}}, recibimos una solicitud para restablecer tu contraseña. Utiliza el siguiente botón para crear una nueva. El enlace vence el {{payload.expiresAt}}.
</mj-text>
<mj-button href="{{payload.resetUrl}}">Restablecer contraseña</mj-button>
<mj-text class="muted">
  ¿No solicitaste esto? Puedes ignorar este mensaje.
</mj-text>
`)

const resetAdminEn = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">Admin password reset</mj-text>
<mj-text>
  Hi {{payload.displayName}}, you requested to reset your administrator password. Click the button below to continue. The link expires on {{payload.expiresAt}}.
</mj-text>
<mj-button href="{{payload.resetUrl}}">Reset administrator password</mj-button>
<mj-text class="muted">
  If this wasn&apos;t you, contact an administrator immediately.
</mj-text>
`)

const resetAdminEs = wrapWithLayout(`
<mj-text font-size="18px" font-weight="600">Restablecer contraseña de administrador</mj-text>
<mj-text>
  Hola {{payload.displayName}}, solicitaste restablecer tu contraseña de administrador. Haz clic en el botón para continuar. El enlace vence el {{payload.expiresAt}}.
</mj-text>
<mj-button href="{{payload.resetUrl}}">Restablecer contraseña</mj-button>
<mj-text class="muted">
  Si no fuiste tú, contacta a un administrador de inmediato.
</mj-text>
`)

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    category: EmailCategory.ORDERS,
    variant: EmailTemplateVariant.CUSTOMER,
    locale: 'en',
    version: 1,
    subject: '[{{companyName}}] Your order #{{payload.orderNumber}}',
    body: orderCustomerEn,
  },
  {
    category: EmailCategory.ORDERS,
    variant: EmailTemplateVariant.CUSTOMER,
    locale: 'es',
    version: 1,
    subject: '[{{companyName}}] Tu pedido #{{payload.orderNumber}}',
    body: orderCustomerEs,
  },
  {
    category: EmailCategory.ORDERS,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'en',
    version: 1,
    subject: '[Orders] New order #{{payload.orderNumber}} received',
    body: orderAdminEn,
  },
  {
    category: EmailCategory.ORDERS,
    variant: EmailTemplateVariant.ADMIN,
    locale: 'es',
    version: 1,
    subject: '[Pedidos] Nuevo pedido #{{payload.orderNumber}} recibido',
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
    subject: 'Restablece tu contraseña de {{companyName}}',
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
