import {
  adjustProductStockTool,
  archiveProductTool,
  confirmQuoteTool,
  createAppointmentTool,
  createCategoryTool,
  createCustomerTool,
  createOrderTool,
  createPaymentTool,
  createProductTool,
  createQuoteTool,
  createSearchAppointmentsTool,
  createSearchCategoriesTool,
  createSearchCustomersTool,
  createSearchOrdersTool,
  createSearchPaymentsTool,
  createSearchProductsTool,
  createSearchQuotesTool,
  deleteAppointmentTool,
  parseAberturasTool,
  prepareAberturasInsertTool,
  prepareAberturasQuoteTool,
  publishProductTool,
  sendQuoteTool,
  updateAppointmentTool,
  updateCategoryTool,
  updateCustomerTool,
  updateOrderCommentTool,
  updateOrderStatusTool,
  updateOrderStructureTool,
  updatePaymentStatusTool,
  updatePaymentTool,
  updateProductTool,
  updateQuoteCommentTool,
  updateQuoteStatusTool,
  updateQuoteStructureTool,
} from './action-tools.js'

const TOOL_BUILDERS = [
  createSearchProductsTool,
  createSearchCategoriesTool,
  createSearchCustomersTool,
  createSearchAppointmentsTool,
  createSearchOrdersTool,
  createSearchQuotesTool,
  createSearchPaymentsTool,
  createCustomerTool,
  updateCustomerTool,
  createAppointmentTool,
  updateAppointmentTool,
  deleteAppointmentTool,
  createProductTool,
  createCategoryTool,
  updateCategoryTool,
  updateProductTool,
  adjustProductStockTool,
  archiveProductTool,
  publishProductTool,
  createOrderTool,
  updateOrderStatusTool,
  updateOrderCommentTool,
  updateOrderStructureTool,
  createQuoteTool,
  sendQuoteTool,
  confirmQuoteTool,
  updateQuoteStatusTool,
  updateQuoteCommentTool,
  updateQuoteStructureTool,
  createPaymentTool,
  updatePaymentStatusTool,
  updatePaymentTool,
  prepareAberturasInsertTool,
  prepareAberturasQuoteTool,
  parseAberturasTool,
]

export function buildToolRegistry(backendClient) {
  return TOOL_BUILDERS.map((builder) => builder(backendClient))
}

export function getToolsForRole(roleConfig, backendClient) {
  const registry = buildToolRegistry(backendClient)
  if (!roleConfig) {
    return registry.filter((tool) => tool.name === 'search_products')
  }

  return registry.filter((tool) => roleConfig.allowedTools.includes(tool.name))
}
