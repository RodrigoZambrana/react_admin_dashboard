"use client"

import { useState } from "react"
import Link from "next/link"
import { StorefrontApi, isApiError } from "@/lib/api/storefront"

interface LoginFormState {
  status: "idle" | "submitting" | "error" | "success"
  error?: string
}

export const LoginForm: React.FC = () => {
  const [state, setState] = useState<LoginFormState>({ status: "idle" })

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    setState({ status: "submitting" })
    try {
      await StorefrontApi.login(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""))
      setState({ status: "success" })
    } catch (error) {
      if (isApiError(error)) {
        setState({ status: "error", error: error.message })
      } else {
        setState({ status: "error", error: "Unexpected error authenticating." })
      }
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-8 shadow-sm">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Welcome back</h2>
        <p className="text-sm text-slate-500">Sign in with your customer credentials to access order history and tracking.</p>
      </div>
      <div className="space-y-4">
        <label className="flex flex-col gap-2 text-sm text-slate-600">
          Email
          <input type="email" name="email" required className="rounded-lg border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-600">
          Password
          <input type="password" name="password" required className="rounded-lg border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" />
        </label>
      </div>
      {state.status === "error" ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{state.error}</p>
      ) : null}
      <button
        type="submit"
        className="w-full rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        disabled={state.status === "submitting"}
      >
        {state.status === "submitting" ? "Signing in..." : state.status === "success" ? "Signed in" : "Sign in"}
      </button>
      <p className="text-center text-xs text-slate-400">
        Need an account? <Link href="/account/register" className="font-semibold text-slate-900 hover:text-slate-600">Create one</Link>
      </p>
    </form>
  )
}
