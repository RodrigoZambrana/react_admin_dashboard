import { auth, signIn, signOut } from "@/auth";

export default async function HomePage() {
  const session = await auth();

  return (
    <main className="p-8 space-y-6">
      <h1 className="text-2xl font-semibold">Next.js + Google Sign In (SSR)</h1>

      {!session ? (
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: "/protected" });
          }}
        >
          <button className="border px-4 py-2 rounded">Sign in with Google</button>
        </form>
      ) : (
        <>
          <div className="space-y-2">
            <p>
              <strong>Signed in as:</strong> {session.user?.email}
            </p>
            <p>
              <strong>Name:</strong> {session.user?.name}
            </p>
          </div>
          <form
            action={async () => {
              "use server";
              await signOut({ redirectTo: "/" });
            }}
          >
            <button className="border px-4 py-2 rounded">Sign out</button>
          </form>
        </>
      )}
    </main>
  );
}
