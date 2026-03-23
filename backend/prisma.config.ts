import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'ts-node --project tsconfig.seed.json --transpile-only prisma/seed.ts',
  },
})
