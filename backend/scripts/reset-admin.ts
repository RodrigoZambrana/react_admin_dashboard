import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'
import {
  assertMaintenanceScriptSafety,
  loadEnvFromBackendRoot,
} from './script-safety'

const prisma = new PrismaClient()

const DEFAULT_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com'
const DEFAULT_NAME = process.env.DEFAULT_ADMIN_NAME || 'Admin'
const DEFAULT_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD
const ALLOW_CREATE =
  String(process.env.ALLOW_ADMIN_BOOTSTRAP_CREATE || '')
    .trim()
    .toLowerCase() === 'true'
const serializeBootstrapAdminValue = (email: string) =>
  JSON.stringify({
    email,
    passwordRotationRequired: true,
    updatedAt: new Date().toISOString(),
  })

async function main() {
  loadEnvFromBackendRoot()
  assertMaintenanceScriptSafety({
    scriptName: 'reset-admin',
    argv: process.argv.slice(2),
    destructive: true,
    defaultDryRun: false,
  })

  if (!DEFAULT_PASSWORD?.trim()) {
    throw new Error('DEFAULT_ADMIN_PASSWORD must be provided to reset the admin user.')
  }

  const target = await prisma.user.findUnique({
    where: { email: DEFAULT_EMAIL },
  })
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)

  if (target) {
    await prisma.user.update({
      where: { id: target.id },
      data: {
        email: DEFAULT_EMAIL,
        name: target.name || DEFAULT_NAME,
        passwordHash,
        role: 'SUPERADMIN',
      },
    })
    console.log(
      `Updated existing admin (id=${target.id}) with email=${DEFAULT_EMAIL} and password=${DEFAULT_PASSWORD}`,
    )
  } else {
    if (!ALLOW_CREATE) {
      throw new Error(
        'Bootstrap admin does not exist. Refusing to create it from reset-admin without ALLOW_ADMIN_BOOTSTRAP_CREATE=true.',
      )
    }
    const created = await prisma.user.create({
      data: {
        email: DEFAULT_EMAIL,
        name: DEFAULT_NAME,
        lastName: '',
        img: '',
        role: 'SUPERADMIN',
        passwordHash,
      },
    })
    console.log(
      `Created admin user (id=${created.id}) with email=${DEFAULT_EMAIL} and password=${DEFAULT_PASSWORD}`,
    )
  }

  await prisma.systemConfig.upsert({
    where: { key: 'auth.bootstrapAdmin' },
    update: {
      value: serializeBootstrapAdminValue(DEFAULT_EMAIL.trim().toLowerCase()),
    },
    create: {
      key: 'auth.bootstrapAdmin',
      value: serializeBootstrapAdminValue(DEFAULT_EMAIL.trim().toLowerCase()),
    },
  })
}

main()
  .catch((error) => {
    console.error('Failed to reset admin user:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
