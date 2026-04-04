import { z } from 'zod';

export const responseFallbackTemplateKeySchema = z.enum([
  'basic_response',
  'clarification_requested_date',
  'clarification_user_goal',
  'clarification_generic',
  'execution_success_booking',
  'execution_success_quote',
  'execution_success_product',
  'execution_success_generic',
  'execution_failure_unknown_tool',
  'execution_failure_validation',
  'execution_failure_generic',
]);

export type ResponseFallbackTemplateKey = z.infer<
  typeof responseFallbackTemplateKeySchema
>;

export const responseFallbackCatalogResourceSchema = z.object({
  locale: z.string().min(2),
  templates: z.object({
    basic_response: z.string().min(1),
    clarification_requested_date: z.string().min(1),
    clarification_user_goal: z.string().min(1),
    clarification_generic: z.string().min(1),
    execution_success_booking: z.string().min(1),
    execution_success_quote: z.string().min(1),
    execution_success_product: z.string().min(1),
    execution_success_generic: z.string().min(1),
    execution_failure_unknown_tool: z.string().min(1),
    execution_failure_validation: z.string().min(1),
    execution_failure_generic: z.string().min(1),
  }),
  actionLabels: z.object({
    create_booking: z.string().min(1),
    create_quote: z.string().min(1),
    get_product: z.string().min(1),
    default: z.string().min(1),
  }),
  defaults: z.object({
    scheduledFor: z.string().min(1),
    currency: z.string().min(1),
    amount: z.string().min(1),
    productName: z.string().min(1),
  }),
});

export type ResponseFallbackCatalogResource = z.infer<
  typeof responseFallbackCatalogResourceSchema
>;
