export const metadata = {
  title: "Forgot password · Storefront"
};

export default function ForgotPasswordPage() {
  return (
    <main>
      {/* TODO: implement password recovery flow when backend endpoint is available */}
      <section style={{ padding: "3rem 1.5rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 600, marginBottom: "0.5rem" }}>Reset password</h1>
        <p style={{ color: "#475569" }}>
          Customers will be able to request a password reset link from this page.
        </p>
      </section>
    </main>
  );
}

