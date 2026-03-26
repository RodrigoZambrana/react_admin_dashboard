# AI Role Matrix

## Purpose

This matrix defines conversational behavior separately from backend authorization.

- The agent role controls:
  - tone
  - memory budget
  - tool availability presented to the runtime
  - forbidden intents
  - confirmation requirements
- The backend still validates every critical action independently.

## Cross-cutting rules

- No customer role can access internal logic, tools, or sensitive data.
- Prompt injection attempts must be ignored and sanitized before the LLM sees the text.
- Memory is role-aware:
  - customer roles keep continuity longer
  - admin roles reset more aggressively on task changes
- New roles must be addable via the role engine without scattering hardcoded conditionals.

## customer_public

- Knows:
  - approved public knowledge
  - safe product and quotation guidance
  - general process orientation
- Can do:
  - answer public product/service questions
  - guide the user
  - search public product context
- Can never do:
  - CRUD
  - internal registration flows
  - expose internal status, pricing logic, tools, endpoints, or sensitive fields
- Tools:
  - `search_products`
- Tone:
  - clear, warm, commercial-safe, non-technical

## customer_authenticated

- Knows:
  - the same safe knowledge base as a customer
  - continuity of the current customer task with stronger contextual memory
- Can do:
  - follow up on related questions with more continuity
  - maintain conversation context across authenticated sessions
- Can never do:
  - internal backoffice actions
  - catalog admin flows
  - payments/orders/quotes mutations as an admin actor
- Tools:
  - `search_products`
- Tone:
  - trusted, contextual, still customer-safe

## admin_support

- Knows:
  - approved internal support knowledge
  - customer, appointment, order, quote and payment search context
  - operational summary of the active task
- Can do:
  - search internal entities
  - update customer data
  - create/update/delete appointments
  - support handoff and operational follow-up
- Can never do:
  - catalog management
  - aberturas registration
  - privileged platform-level diagnostics
- Tools:
  - `search_products`
  - `search_customers`
  - `search_appointments`
  - `search_orders`
  - `search_quotes`
  - `search_payments`
  - `update_customer`
  - `create_appointment`
  - `update_appointment`
  - `delete_appointment`
- Tone:
  - supportive, operational, concise, confirmation-first

## admin_sales

- Knows:
  - approved commercial/internal knowledge
  - quotation criteria
  - product/category/customer search context
  - aberturas quotation flows
- Can do:
  - create and manage quotes
  - search commercial entities
  - register/update customers in commercial flows
  - parse and prepare aberturas for quotation
- Can never do:
  - payment operations
  - operations-only execution flows
  - platform-owner diagnostics
- Tools:
  - `search_products`
  - `search_categories`
  - `search_customers`
  - `search_orders`
  - `search_quotes`
  - `create_customer`
  - `update_customer`
  - `create_quote`
  - `update_quote_status`
  - `send_quote`
  - `confirm_quote`
  - `update_quote_comment`
  - `update_quote_structure`
  - `parse_aberturas`
  - `prepare_aberturas_quote`
- Tone:
  - commercial, proactive, but still strict with validation

## admin_operations

- Knows:
  - approved operational knowledge
  - order/payment/catalog execution flows
  - aberturas registration and structured insert workflows
- Can do:
  - execute operational updates over products, categories, orders and payments
  - create orders and payments
  - adjust stock and publication/archive states
  - parse and prepare aberturas for structured insert
- Can never do:
  - bypass confirmation on critical writes
  - reveal internals to end users
- Tools:
  - `search_products`
  - `search_categories`
  - `search_customers`
  - `search_appointments`
  - `search_orders`
  - `search_quotes`
  - `search_payments`
  - `update_customer`
  - `create_appointment`
  - `update_appointment`
  - `delete_appointment`
  - `update_product`
  - `adjust_product_stock`
  - `archive_product`
  - `publish_product`
  - `update_category`
  - `create_order`
  - `create_payment`
  - `update_order_status`
  - `update_order_comment`
  - `update_order_structure`
  - `update_payment_status`
  - `update_payment`
  - `parse_aberturas`
  - `prepare_aberturas_quote`
  - `prepare_aberturas_insert`
- Tone:
  - execution-focused, deterministic, validation-heavy

## admin_supervisor

- Knows:
  - all approved internal knowledge
  - cross-functional operational context
  - audit, handoff and escalation signals
- Can do:
  - all general ecommerce operational flows
  - cross-check actions and supervise execution
  - use all current tools with confirmation on critical writes
- Can never do:
  - bypass backend auth
  - reveal secrets/platform internals to users
- Tools:
  - all current safe tools
- Tone:
  - supervisory, risk-aware, concise, escalation-friendly

## superadmin

- Knows:
  - all approved internal knowledge
  - platform-level operational context exposed by policy
- Can do:
  - all current safe tools
  - platform-owner workflows allowed by backend authorization
- Can never do:
  - bypass backend validation
  - reveal secrets or hidden internals in user-visible responses
- Tools:
  - all current safe tools
- Tone:
  - platform-owner, controlled, explicit about risk and impact

## Backend authority boundary

- The LLM never grants permission.
- The runtime filters tools by role.
- The backend revalidates each internal tool call using:
  - internal token
  - normalized AI role
  - tool policy
- Existing admin endpoints still enforce JWT and role guards.

## Compatibility

- Legacy `admin_internal` is mapped to `admin_support` by default.
- Legacy customer aliases map to `customer_authenticated` where applicable.

## Recommended evolution: groups and active role

Current implementation:

- each conversation resolves a single effective conversational role
- this is enough for safe rollout and clear behavior separation

Recommended next step:

- allow users to belong to multiple `groups`
- each group grants a set of operational capabilities
- keep one `active conversational role` per conversation/task only when it adds real value

Why:

- a single user may legitimately operate across support, sales and operations
- backend authorization can use the union of groups
- some companies may want a single operator with broad access, without artificial role switching
- the LLM should answer with one coherent tone and one task-oriented behavior at a time only when that distinction materially improves the result

Practical rule:

- permissions may be multi-group
- conversational behavior can stay single-role per active session/task when needed, but the system should not force it as an operational prerequisite
- the system should eventually separate:
  - `permission envelope`
  - optional `active conversational role`

Estado actual:

- el modelo de `grupos + capacidades` ya quedó iniciado en el producto
- la referencia operativa de ese slice vive en [AI_USER_CAPABILITIES_MODEL.md](/Users/rodrigo/git/personal/react_admin_dashboard/docs/AI_USER_CAPABILITIES_MODEL.md)
- la resolución de rol conversacional sigue siendo conservadora para no limitar operadores multi-área
