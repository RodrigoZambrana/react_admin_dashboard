import Link from "next/link";
import Container from "@component/Container";
import { listMockCmsVersions } from "@/lib/mock-cms";

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
  gap: "24px",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
};

const cardStyle = {
  border: "1px solid rgba(148, 163, 184, 0.25)",
  borderRadius: "24px",
  background: "rgba(255, 255, 255, 0.9)",
  padding: "24px",
  boxShadow: "0 18px 60px rgba(15, 23, 42, 0.08)",
};

const itemListStyle = {
  marginTop: "16px",
  display: "grid",
  gap: "16px",
};

export default function MockHomeIndexPage() {
  const homeVersions = listMockCmsVersions("home");
  const multimediaVersions = listMockCmsVersions("multimedia");

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
              }}
            >
              Mock explorer
            </p>
            <h1 style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", lineHeight: 1.05, margin: 0 }}>
              Visual prototypes for CMS-driven storefronts
            </h1>
            <p style={{ maxWidth: "760px", color: "#475569", fontSize: "1.05rem", marginTop: "16px" }}>
              Parallel mock routes for testing compositions, versioning and multimedia-heavy pages
              without touching the production storefront.
            </p>
          </div>

          <section style={gridStyle}>
            <div style={cardStyle}>
              <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Template homes</h2>
              <div style={itemListStyle}>
                <div>
                  <Link href="/mock/templates" style={{ color: "#0f172a", fontWeight: 700 }}>
                    Open template explorer
                  </Link>
                  <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                    Exact replicas of the base theme home pages.
                  </p>
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Home mocks</h2>
              <div style={itemListStyle}>
                {homeVersions.map((item) => (
                  <div key={item.version}>
                    <Link href={`/mock/home/${item.version}`} style={{ color: "#0f172a", fontWeight: 700 }}>
                      {item.title}
                    </Link>
                    <p style={{ margin: "6px 0 0", color: "#64748b" }}>{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div style={cardStyle}>
              <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Multimedia mocks</h2>
              <div style={itemListStyle}>
                {multimediaVersions.map((item) => (
                  <div key={item.version}>
                    <Link href={`/mock/multimedia/${item.version}`} style={{ color: "#0f172a", fontWeight: 700 }}>
                      {item.title}
                    </Link>
                    <p style={{ margin: "6px 0 0", color: "#64748b" }}>{item.description}</p>
                  </div>
                ))}
                <div>
                  <Link href="/mock/multimedia" style={{ color: "#0f172a", fontWeight: 700 }}>
                    Multimedia home
                  </Link>
                  <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                    Entry point for product-linked multimedia discovery.
                  </p>
                </div>
              </div>
            </div>

            <div style={cardStyle}>
              <h2 style={{ margin: 0, fontSize: "1.3rem" }}>Experiments</h2>
              <div style={itemListStyle}>
                <div>
                  <Link href="/mock/home/v1" style={{ color: "#0f172a", fontWeight: 700 }}>
                    Home v1
                  </Link>
                  <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                    Kept as a visual experiment, not as the primary design path.
                  </p>
                </div>
                <div>
                  <Link href="/mock/home/v2" style={{ color: "#0f172a", fontWeight: 700 }}>
                    Home v2
                  </Link>
                  <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                    Editorial experiment.
                  </p>
                </div>
                <div>
                  <Link href="/mock/home/v3" style={{ color: "#0f172a", fontWeight: 700 }}>
                    Home v3
                  </Link>
                  <p style={{ margin: "6px 0 0", color: "#64748b" }}>
                    Candidate experiment.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </Container>
  );
}
