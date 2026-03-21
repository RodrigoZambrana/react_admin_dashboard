import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

const DEFAULT_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com'
const DEFAULT_NAME = process.env.DEFAULT_ADMIN_NAME || 'Admin'
const DEFAULT_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD

async function main() {
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
}

main()
  .catch((error) => {
    console.error('Failed to reset admin user:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
