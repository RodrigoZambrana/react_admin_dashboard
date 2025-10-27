import { CartView } from "@/components/cart/CartView";

export const metadata = {
  title: "Your cart · Storefront",
};

export default function CartPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Your cart</h1>
        <p className="text-sm text-slate-500">
          Items in your cart are reserved for a limited time. Complete checkout to confirm inventory allocation.
        </p>
      </header>
      <CartView />
    </div>
  );
}
