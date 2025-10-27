export const metadata = {
  title: "Search · Storefront"
};

export default function SearchPage() {
  return (
    <main>
      {/* TODO: implement client-side search experience using backend catalog endpoint */}
      <section style={{ padding: "3rem 1.5rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 600, marginBottom: "0.5rem" }}>Search</h1>
        <p style={{ color: "#475569" }}>
          Live search UI will query the `/storefront/products` endpoint with debounced requests.
        </p>
      </section>
    </main>
  );
}

