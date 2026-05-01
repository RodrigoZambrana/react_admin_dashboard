import Link from "next/link";
import Container from "@component/Container";
import { listMockTemplateHomes } from "@/lib/mock-template-homes";

export const dynamic = "force-dynamic";

const shellStyle = {
  padding: "64px 0",
};

const pageStyle = {
  maxWidth: "1120px",
  margin: "0 auto",
  padding: "0 16px",
};

const gridStyle = {
  display: "grid",
  gap: "20px",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
};

const cardStyle = {
  border: "1px solid rgba(148, 163, 184, 0.25)",
  borderRadius: "24px",
  background: "rgba(255, 255, 255, 0.9)",
  padding: "24px",
  boxShadow: "0 18px 60px rgba(15, 23, 42, 0.08)",
};

export default function MockTemplatesIndexPage() {
  const templates = listMockTemplateHomes();

  return (
    <Container>
      <div style={shellStyle}>
        <div style={pageStyle}>
          <div style={{ marginBottom: "32px" }}>
            <p
              style={{
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.24em",
                textTransform: "uppercase",
                color: "#64748b",
                marginBottom: "12px",
              }}>
              Template explorer
            </p>
            <h1 style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", lineHeight: 1.05, margin: 0 }}>
              Exact home templates from the base system
            </h1>
            <p style={{ maxWidth: "760px", color: "#475569", fontSize: "1.05rem", marginTop: "16px" }}>
              Each route mirrors a concrete homepage composition from the template base using local
              code already present in this repository.
            </p>
          </div>

          <section style={gridStyle}>
            {templates.map((item) => (
              <article key={item.key} style={cardStyle}>
                <Link href={`/mock/templates/${item.key}`} style={{ color: "#0f172a", fontWeight: 800 }}>
                  {item.title}
                </Link>
                <p style={{ margin: "8px 0 0", color: "#64748b" }}>{item.description}</p>
              </article>
            ))}
          </section>
        </div>
      </div>
    </Container>
  );
}
