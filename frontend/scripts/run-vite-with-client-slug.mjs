#!/usr/bin/env node

import { spawn } from 'node:child_process'

const args = process.argv.slice(2)

const env = { ...process.env }

const clientSlug = env.CLIENT_SLUG?.trim()
if (clientSlug && !env.VITE_CLIENT_SLUG) {
  env.VITE_CLIENT_SLUG = clientSlug
}

const child = spawn('vite', args, {
  stdio: 'inherit',
  shell: true,
  env,
})

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal)
    return
  }

  process.exit(code ?? 0)
})
