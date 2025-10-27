export const metadata = {
  title: "Order history · Storefront"
};

export default function AccountOrdersPage() {
  return (
    <main>
      {/* TODO: fetch authenticated orders and render Bonik dashboard */}
      <section style={{ padding: "3rem 1.5rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 600, marginBottom: "0.5rem" }}>Order history</h1>
        <p style={{ color: "#475569" }}>
          Customer order tracking will be displayed here once authentication is integrated.
        </p>
      </section>
    </main>
  );
}

