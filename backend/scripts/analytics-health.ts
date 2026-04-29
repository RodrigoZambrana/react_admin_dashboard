import { inspect } from 'node:util'

import { runAnalyticsHealth } from './analytics-health-core'

function hasFlag(name: string) {
  return process.argv.slice(2).some((entry) => entry === name || entry.startsWith(`${name}=`))
}

async function main() {
  const result = await runAnalyticsHealth({
    mode: (process.argv.slice(2).find((entry) => entry === '--mode=ci' || entry === '--mode=monitor')
      ? (process.argv.slice(2).find((entry) => entry.startsWith('--mode='))?.split('=')[1] as
          | 'ci'
          | 'monitor')
      : (process.env.ANALYTICS_HEALTH_MODE as 'default' | 'ci' | 'monitor' | undefined)) ?? 'default',
    baseUrl: process.argv.slice(2).find((entry) => entry.startsWith('--base-url='))?.split('=')[1],
    queueName: process.argv.slice(2).find((entry) => entry.startsWith('--queue-name='))?.split('=')[1],
    queueUrl: process.argv.slice(2).find((entry) => entry.startsWith('--queue-url='))?.split('=')[1],
    json: hasFlag('--json') || process.argv.slice(2).some((entry) => entry === '--mode=ci'),
  })

  const json = hasFlag('--json') || process.argv.slice(2).some((entry) => entry === '--mode=ci')
  if (json) {
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result))
  } else {
    // eslint-disable-next-line no-console
    console.log(inspect(result, { depth: 10, colors: true, compact: false }))
  }

  if (result.status === 'fail') {
    process.exitCode = 1
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[analytics-health] failed', error)
  process.exitCode = 1
})
