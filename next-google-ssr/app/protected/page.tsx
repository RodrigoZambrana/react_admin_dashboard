import { auth } from "@/auth";
import Link from "next/link";

export default async function ProtectedPage() {
  const session = await auth();
  if (!session) {
    return (
      <main className="p-8">
        <p>You must sign in to view this page.</p>
        <Link className="underline" href="/">
          Go back
        </Link>
      </main>
    );
  }

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-2xl font-semibold">Protected (SSR)</h1>
      <p>Welcome, {session.user?.name ?? session.user?.email} 🎉</p>
      <ul className="list-disc pl-6">
        <li>
          Guarded by <code>middleware.ts</code> on the server.
        </li>
        <li>
          Session resolved server-side with <code>auth()</code>.
        </li>
      </ul>
      <Link className="underline" href="/">
        Home
      </Link>
    </main>
  );
}
