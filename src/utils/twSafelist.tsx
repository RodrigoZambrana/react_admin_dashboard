// This file exists to safelist dynamic Tailwind classes referenced at runtime.
// It is not imported anywhere; Tailwind JIT scans source files and will include these classes.

export default function TWSafelist() {
    return null
}

// bg/text color classes used dynamically
// bg-blue-500 text-blue-500 bg-violet-500 text-violet-500 bg-indigo-500 text-indigo-500
// bg-teal-500 text-teal-500 bg-cyan-500 text-cyan-500 bg-fuchsia-500 text-fuchsia-500
// bg-rose-500 text-rose-500 bg-lime-500 text-lime-500
// base colors
// bg-emerald-500 text-emerald-500 bg-amber-500 text-amber-500 bg-red-500 text-red-500

