import axios from "axios";
import MockAdapter from "axios-mock-adapter";
import { MockEndPoints } from "__server__";
import { env } from "./env";

const enableMocks =
  process.env.NEXT_PUBLIC_ENABLE_STOREFRONT_MOCKS === "true" ||
  process.env.ENABLE_STOREFRONT_MOCKS === "true";

// Axios instance points to the backend storefront API by default
const axiosInstance = axios.create({
  baseURL: env.publicApiBaseUrl,
});

export let Mock: MockAdapter | null = null;

export const mocksEnabled = enableMocks;

if (enableMocks) {
  Mock = new MockAdapter(axiosInstance, { delayResponse: 400 });
  MockEndPoints(Mock);
}

export default axiosInstance;
