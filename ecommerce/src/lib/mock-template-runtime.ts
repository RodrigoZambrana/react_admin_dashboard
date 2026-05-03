import MockAdapter from "axios-mock-adapter";

import { env } from "@/lib/env";
import axiosInstance, { Mock, mocksEnabled } from "@lib/axios";
import { MockEndPoints } from "__server__";

export const isMockTemplateHomesEnabled = () =>
  env.isDevelopment || process.env.LOCAL_TEST_ENV === "true" || process.env.E2E_MOCK_TEMPLATES === "true";

export async function withMockTemplateRuntime<T>(render: () => Promise<T> | T): Promise<T> {
  if (!isMockTemplateHomesEnabled()) {
    throw new Error("Mock template homes are disabled in this environment.");
  }

  if (Mock || mocksEnabled) {
    return render();
  }

  const adapter = new MockAdapter(axiosInstance, { delayResponse: 0 });
  MockEndPoints(adapter);

  try {
    return await render();
  } finally {
    adapter.restore();
  }
}
