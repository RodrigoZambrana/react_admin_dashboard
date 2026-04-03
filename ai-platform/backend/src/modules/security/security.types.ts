export type ApiAuthMode = 'open' | 'bearer';

export type AdminEndpointPlan = {
  path: string;
  futureGuard: 'AdminOnlyGuard';
};

export type SecurityPreparationPlan = {
  apiAuthMode: ApiAuthMode;
  futureApiAuthMode: 'bearer';
  adminEndpoints: AdminEndpointPlan[];
  apiKeyStorage: {
    current: 'env';
    future: 'database';
  };
};
