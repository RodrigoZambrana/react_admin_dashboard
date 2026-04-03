export type DecisionAction = 'respond' | 'clarify' | 'invoke_tool';
export type DecisionDomain = 'core' | 'tenant';
export type ToolName = 'create_booking' | 'get_product' | 'create_quote';

export type DecisionResult = {
  domain: DecisionDomain;
  action: DecisionAction;
  toolName?: ToolName;
  reasonCode: string;
  missingFields: string[];
  responseTemplateKey: string;
};
