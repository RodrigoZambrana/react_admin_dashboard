export const ACTION_REGISTRY = {
  'aberturas.register': {
    key: 'aberturas.register',
    draftBuilder: 'buildAberturasRegisterDraft',
    requiresConfirmation: true,
  },
  'appointments.create': {
    key: 'appointments.create',
    draftBuilder: 'buildAppointmentCreateDraft',
    requiresConfirmation: true,
    draftPresentation: {
      intro: 'Identifiqué una nueva cita para agendar.',
      confirmationPrompt: '¿Deseas agendar esta cita? Si confirmas, la crearé ahora.',
      pendingPrompt: 'Antes de seguir necesito completar esos datos.',
      successPrefix: 'Cita creada correctamente.',
      errorText:
        'La confirmación fue recibida, pero la creación de la cita falló. Revisa el payload y el error reportado abajo.',
      debugDetail:
        'Se extrajeron título, fecha/hora y ubicación desde el texto de entrada para una creación confirmable.',
    },
    execute: {
      toolName: 'create_appointment',
      backendMethod: 'createAppointment',
      verifyEntity: 'appointment',
      verifyMode: 'detail',
      entityLabel: 'cita',
      resultShape: 'resource_created',
    },
  },
  'appointments.update': {
    key: 'appointments.update',
    draftBuilder: 'buildAppointmentUpdateDraft',
    requiresConfirmation: true,
    draftPresentation: {
      intro: 'He preparado la actualización de la cita.',
      confirmationPrompt: '¿Deseas aplicar estos cambios a la cita encontrada?',
      pendingPrompt:
        'Antes de seguir necesito identificar la cita objetivo y los cambios a aplicar.',
      successPrefix: 'Cita actualizada correctamente.',
      errorText:
        'La confirmación fue recibida, pero la actualización de la cita falló. Revisa el payload y el error reportado abajo.',
    },
    execute: {
      toolName: 'update_appointment',
      backendMethod: 'updateAppointment',
      verifyEntity: 'appointment',
      verifyMode: 'detail',
      entityLabel: 'cita',
      requiresTargetId: true,
      resultShape: 'resource_updated',
    },
  },
  'appointments.delete': {
    key: 'appointments.delete',
    draftBuilder: 'buildAppointmentDeleteDraft',
    requiresConfirmation: true,
    draftPresentation: {
      intro: 'He preparado la eliminación de la cita.',
      confirmationPrompt:
        '¿Deseas eliminar esta cita? Si confirmas, ejecutaré la eliminación y te devolveré el resultado.',
      pendingPrompt:
        'Antes de seguir necesito identificar con precisión la actividad a eliminar.',
      successPrefix: 'Cita eliminada correctamente.',
      errorText:
        'La confirmación fue recibida, pero no pude eliminar la cita. Revisa el error reportado abajo.',
      debugDetail:
        'Delete confirmable resuelto sobre actividad previamente encontrada por prebúsqueda.',
      targetLabel: 'actividad objetivo',
    },
    execute: {
      toolName: 'delete_appointment',
      backendMethod: 'deleteAppointment',
      verifyEntity: null,
      verifyMode: 'none',
      entityLabel: 'cita',
      requiresTargetId: true,
      resultShape: 'resource_deleted',
    },
  },
  'customers.create': {
    key: 'customers.create',
    draftBuilder: 'buildCustomerCreateDraft',
    requiresConfirmation: true,
    draftPresentation: {
      intro: 'He preparado el alta del cliente.',
      confirmationPrompt: '¿Deseas registrar este cliente ahora?',
      pendingPrompt:
        'Antes de seguir necesito completar o corregir los datos faltantes o dudosos.',
      successPrefix: 'Cliente procesado correctamente.',
      errorText:
        'La confirmación fue recibida, pero no pude registrar el cliente. Revisa el payload y el error reportado abajo.',
    },
    execute: {
      toolName: 'create_customer',
      backendMethod: 'createCustomer',
      verifyEntity: 'customer',
      verifyMode: 'detail',
      entityLabel: 'cliente',
      resultShape: 'resource_created',
    },
  },
  'customers.update': {
    key: 'customers.update',
    draftBuilder: 'buildCustomerUpdateDraft',
    requiresConfirmation: true,
    draftPresentation: {
      intro: 'He preparado la actualización del cliente.',
      confirmationPrompt: '¿Deseas aplicar estos cambios al cliente encontrado?',
      pendingPrompt:
        'Antes de seguir necesito identificar el cliente objetivo y corregir los datos dudosos o faltantes.',
      successPrefix: 'Cliente actualizado correctamente.',
      errorText:
        'La confirmación fue recibida, pero no pude actualizar el cliente. Revisa el payload y el error reportado abajo.',
      targetLabel: 'cliente objetivo',
    },
    execute: {
      toolName: 'update_customer',
      backendMethod: 'updateCustomer',
      verifyEntity: 'customer',
      verifyMode: 'detail',
      entityLabel: 'cliente',
      requiresTargetId: true,
      resultShape: 'resource_updated',
    },
  },
  'products.create': {
    key: 'products.create',
    draftBuilder: 'buildProductCreateDraft',
    batchDraftBuilder: 'buildProductBatchDraft',
    requiresConfirmation: true,
    draftPresentation: {
      intro: 'He preparado el alta del producto.',
      confirmationPrompt: '¿Deseas crear este producto ahora?',
      pendingPrompt:
        'Antes de seguir necesito completar o corregir precio, moneda o nombre del producto.',
      successPrefix: 'Producto creado correctamente.',
      errorText:
        'La confirmación fue recibida, pero no pude crear el producto. Revisa el payload y el error reportado abajo.',
      batchIntro:
        'He preparado el alta en lote de productos desde los datos tabulares detectados.',
      batchConfirmationPrompt:
        '¿Deseas crear los productos válidos detectados en el lote? Si confirmas, los crearé ahora y devolveré enlaces de verificación.',
      batchPendingPrompt:
        'Todavía no hay filas válidas suficientes para ejecutar el alta en lote.',
      batchSuccessTitle: 'Productos creados correctamente desde el lote:',
      batchReadyTitle: 'Listos para alta',
      batchPendingTitle: 'Pendientes',
      batchDebugDetail:
        'Se usaron filas tabulares extraídas desde CSV/XLSX para construir un draft batch de productos.',
    },
    execute: {
      toolName: 'create_product',
      backendMethod: 'createProduct',
      verifyEntity: 'product',
      verifyMode: 'detail',
      entityLabel: 'producto',
      resultShape: 'resource_created',
    },
  },
  'products.update': {
    key: 'products.update',
    draftBuilder: 'buildProductUpdateDraft',
    requiresConfirmation: true,
    draftPresentation: {
      intro: 'He preparado la actualización del producto.',
      confirmationPrompt: '¿Deseas aplicar estos cambios al producto encontrado?',
      pendingPrompt:
        'Antes de seguir necesito identificar el producto objetivo y corregir los datos faltantes o dudosos.',
      successPrefix: 'Producto actualizado correctamente.',
      errorText:
        'La confirmación fue recibida, pero no pude actualizar el producto. Revisa el payload y el error reportado abajo.',
      targetLabel: 'producto objetivo',
    },
    execute: {
      toolName: 'update_product',
      backendMethod: 'updateProduct',
      verifyEntity: 'product',
      verifyMode: 'detail',
      entityLabel: 'producto',
      requiresTargetId: true,
      resultShape: 'resource_updated',
    },
  },
  'orders.update_status': {
    key: 'orders.update_status',
    draftBuilder: 'buildDocumentActionDraft',
    entityType: 'order',
    draftPresentation: {
      targetEntityLabel: 'pedido',
      intro: 'He preparado el cambio de estado del pedido.',
      confirmationPrompt:
        '¿Deseas aplicar este cambio de estado al pedido encontrado?',
      successPrefix: 'Pedido actualizado correctamente.',
      pendingPrompt:
        'Antes de seguir necesito identificar correctamente el pedido objetivo y completar los datos faltantes.',
    },
    searchTool: 'search_orders',
    executionTool: 'update_order_status',
    verifyEntity: 'order',
    operationKind: 'status',
    requiresConfirmation: true,
    execute: {
      toolName: 'update_order_status',
      backendMethod: 'updateOrderStatus',
      verifyEntity: 'order',
      verifyMode: 'detail',
      entityLabel: 'pedido',
      requiresTargetId: true,
      resultShape: 'status_updated',
    },
  },
  'orders.update_comment': {
    key: 'orders.update_comment',
    draftBuilder: 'buildDocumentActionDraft',
    entityType: 'order',
    draftPresentation: {
      targetEntityLabel: 'pedido',
      intro: 'He preparado la actualización del comentario del pedido.',
      confirmationPrompt:
        '¿Deseas aplicar este comentario al pedido encontrado?',
      successPrefix: 'Pedido actualizado correctamente.',
      pendingPrompt:
        'Antes de seguir necesito identificar correctamente el pedido objetivo y completar los datos faltantes.',
    },
    searchTool: 'search_orders',
    executionTool: 'update_order_comment',
    verifyEntity: 'order',
    operationKind: 'comment',
    requiresConfirmation: true,
    execute: {
      toolName: 'update_order_comment',
      backendMethod: 'updateOrderComment',
      verifyEntity: 'order',
      verifyMode: 'detail',
      entityLabel: 'pedido',
      requiresTargetId: true,
      resultShape: 'comment_updated',
    },
  },
  'quotes.update_status': {
    key: 'quotes.update_status',
    draftBuilder: 'buildDocumentActionDraft',
    entityType: 'quote',
    draftPresentation: {
      targetEntityLabel: 'presupuesto',
      intro: 'He preparado el cambio de estado del presupuesto.',
      confirmationPrompt:
        '¿Deseas aplicar este cambio de estado al presupuesto encontrado?',
      successPrefix: 'Presupuesto actualizado correctamente.',
      pendingPrompt:
        'Antes de seguir necesito identificar correctamente el presupuesto objetivo y completar los datos faltantes.',
    },
    searchTool: 'search_quotes',
    executionTool: 'update_quote_status',
    verifyEntity: 'quote',
    operationKind: 'status',
    requiresConfirmation: true,
    execute: {
      toolName: 'update_quote_status',
      backendMethod: 'updateQuoteStatus',
      verifyEntity: 'quote',
      verifyMode: 'detail',
      entityLabel: 'presupuesto',
      requiresTargetId: true,
      resultShape: 'status_updated',
    },
  },
  'quotes.update_comment': {
    key: 'quotes.update_comment',
    draftBuilder: 'buildDocumentActionDraft',
    entityType: 'quote',
    draftPresentation: {
      targetEntityLabel: 'presupuesto',
      intro: 'He preparado la actualización del comentario del presupuesto.',
      confirmationPrompt:
        '¿Deseas aplicar este comentario al presupuesto encontrado?',
      successPrefix: 'Presupuesto actualizado correctamente.',
      pendingPrompt:
        'Antes de seguir necesito identificar correctamente el presupuesto objetivo y completar los datos faltantes.',
    },
    searchTool: 'search_quotes',
    executionTool: 'update_quote_comment',
    verifyEntity: 'quote',
    operationKind: 'comment',
    requiresConfirmation: true,
    execute: {
      toolName: 'update_quote_comment',
      backendMethod: 'updateQuoteComment',
      verifyEntity: 'quote',
      verifyMode: 'detail',
      entityLabel: 'presupuesto',
      requiresTargetId: true,
      resultShape: 'comment_updated',
    },
  },
  'quotes.send': {
    key: 'quotes.send',
    draftBuilder: 'buildDocumentActionDraft',
    entityType: 'quote',
    draftPresentation: {
      targetEntityLabel: 'presupuesto',
      intro: 'He preparado el envío del presupuesto.',
      confirmationPrompt: '¿Deseas marcar como enviado el presupuesto encontrado?',
      successPrefix: 'Presupuesto enviado correctamente.',
      pendingPrompt:
        'Antes de seguir necesito identificar correctamente el presupuesto objetivo.',
    },
    searchTool: 'search_quotes',
    executionTool: 'send_quote',
    verifyEntity: 'quote',
    operationKind: 'send',
    requiresConfirmation: true,
    execute: {
      toolName: 'send_quote',
      backendMethod: 'sendQuote',
      verifyEntity: 'quote',
      verifyMode: 'detail',
      entityLabel: 'presupuesto',
      requiresTargetId: true,
      resultShape: 'outbound_sent',
    },
  },
  'quotes.confirm': {
    key: 'quotes.confirm',
    draftBuilder: 'buildDocumentActionDraft',
    entityType: 'quote',
    draftPresentation: {
      targetEntityLabel: 'presupuesto',
      intro: 'He preparado la confirmación del presupuesto.',
      confirmationPrompt:
        '¿Deseas confirmar el presupuesto encontrado y convertirlo según el flujo real?',
      successPrefix: 'Presupuesto confirmado correctamente.',
      pendingPrompt:
        'Antes de seguir necesito identificar correctamente el presupuesto objetivo.',
    },
    searchTool: 'search_quotes',
    executionTool: 'confirm_quote',
    verifyEntity: 'order',
    operationKind: 'confirm',
    requiresConfirmation: true,
    execute: {
      toolName: 'confirm_quote',
      backendMethod: 'confirmQuote',
      verifyEntity: 'order',
      verifyMode: 'detail',
      entityLabel: 'pedido',
      requiresTargetId: true,
      resultShape: 'document_confirmed',
    },
  },
  'payments.update_status': {
    key: 'payments.update_status',
    draftBuilder: 'buildDocumentActionDraft',
    entityType: 'payment',
    draftPresentation: {
      targetEntityLabel: 'pago',
      intro: 'He preparado el cambio de estado del pago.',
      confirmationPrompt:
        '¿Deseas aplicar este cambio de estado al pago encontrado?',
      successPrefix: 'Pago actualizado correctamente.',
      pendingPrompt:
        'Antes de seguir necesito identificar correctamente el pago objetivo y completar los datos faltantes.',
    },
    searchTool: 'search_payments',
    executionTool: 'update_payment_status',
    verifyEntity: 'payment',
    operationKind: 'status',
    requiresConfirmation: true,
    execute: {
      toolName: 'update_payment_status',
      backendMethod: 'updatePaymentStatus',
      verifyEntity: 'payment',
      verifyMode: 'detail',
      entityLabel: 'pago',
      requiresTargetId: true,
      resultShape: 'status_updated',
    },
  },
  'payments.update': {
    key: 'payments.update',
    draftBuilder: 'buildDocumentActionDraft',
    entityType: 'payment',
    draftPresentation: {
      targetEntityLabel: 'pago',
      intro: 'He preparado la actualización del pago.',
      confirmationPrompt: '¿Deseas aplicar estos cambios al pago encontrado?',
      successPrefix: 'Pago actualizado correctamente.',
      pendingPrompt:
        'Antes de seguir necesito identificar correctamente el pago objetivo y completar los datos faltantes.',
    },
    searchTool: 'search_payments',
    executionTool: 'update_payment',
    verifyEntity: 'payment',
    operationKind: 'update',
    requiresConfirmation: true,
    execute: {
      toolName: 'update_payment',
      backendMethod: 'updatePayment',
      verifyEntity: 'payment',
      verifyMode: 'detail',
      entityLabel: 'pago',
      requiresTargetId: true,
      resultShape: 'resource_updated',
    },
  },
}
