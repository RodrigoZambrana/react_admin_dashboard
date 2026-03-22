import { isDemoRouteEnabled } from "@/lib/public-route-policy";

export default async function MobileCategoryNavPage() {
  if (!isDemoRouteEnabled()) {
    return null;
  }

  const demoPageModule = await import("./page.demo");
  const DemoPage = demoPageModule.default;

  return <DemoPage />;
}
