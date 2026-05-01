import MockAdapter from "axios-mock-adapter";

import axiosInstance, { Mock, mocksEnabled } from "@lib/axios";
import { MockEndPoints } from "__server__";

export async function withMockTemplateRuntime<T>(render: () => Promise<T> | T): Promise<T> {
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
