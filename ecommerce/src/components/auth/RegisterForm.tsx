"use client"

import { useState } from "react"
import Link from "next/link"
import { StorefrontApi, isApiError } from "@/lib/api/storefront"

interface RegisterFormState {
  status: "idle" | "submitting" | "error" | "success"
  error?: string
}

export const RegisterForm: React.FC = () => {
  const [state, setState] = useState<RegisterFormState>({ status: "idle" })

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)

    setState({ status: "submitting" })
    try {
      await StorefrontApi.register({
        email: String(formData.get("email") ?? ""),
        password: String(formData.get("password") ?? ""),
        firstName: String(formData.get("firstName") ?? ""),
        lastName: String(formData.get("lastName") ?? ""),
      })
      setState({ status: "success" })
    } catch (error) {
      if (isApiError(error)) {
        setState({ status: "error", error: error.message })
      } else {
        setState({ status: "error", error: "Unexpected error creating your account." })
      }
    }
  }

  if (state.status === "success") {
    return (
      <div className="rounded-[var(--radius-lg)] border border-emerald-200 bg-emerald-50 p-8 text-emerald-900">
        <h2 className="text-xl font-semibold">Account created</h2>
        <p className="mt-3 text-sm">
          Your profile is now active in the backend system. Sign in to manage addresses, view purchases, and create
          support tickets.
        </p>
        <Link href="/account/login" className="mt-6 inline-flex items-center rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white">
          Continue to login
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-[var(--radius-lg)] border border-slate-200 bg-white p-8 shadow-sm">
      <div className="space-y-2 text-center">
        <h2 className="text-xl font-semibold text-slate-900">Create an account</h2>
        <p className="text-sm text-slate-500">Register to speed up checkout and access order history.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm text-slate-600">
          First name
          <input name="firstName" required className="rounded-lg border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-600">
          Last name
          <input name="lastName" required className="rounded-lg border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-600 sm:col-span-2">
          Email
          <input type="email" name="email" required className="rounded-lg border border-slate-200 px-3 py-2 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200" />
        </label>
        <label className="flex flex-col gap-2 text-sm text-slate-600 sm:col-span-2">
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
        {state.status === "submitting" ? "Creating account..." : "Create account"}
      </button>
      <p className="text-center text-xs text-slate-400">
        Already registered? <Link href="/account/login" className="font-semibold text-slate-900 hover:text-slate-600">Sign in</Link>
      </p>
    </form>
  )
}
