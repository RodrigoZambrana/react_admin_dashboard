import { PrismaClient } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

const DEFAULT_USERNAME = process.env.DEFAULT_ADMIN_USERNAME || 'admin'
const DEFAULT_EMAIL = process.env.DEFAULT_ADMIN_EMAIL || 'admin@example.com'
const DEFAULT_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD || 'admin123'
const DEFAULT_NAME = process.env.DEFAULT_ADMIN_NAME || 'Admin'

async function resolveTargetUser() {
  const byUserName = await prisma.user.findUnique({
    where: { userName: DEFAULT_USERNAME },
  })
  if (byUserName) {
    return byUserName
  }
  const byEmail = await prisma.user.findUnique({
    where: { email: DEFAULT_EMAIL },
  })
  return byEmail
}

async function main() {
  const target = await resolveTargetUser()
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10)

  if (target) {
    await prisma.user.update({
      where: { id: target.id },
      data: {
        userName: DEFAULT_USERNAME,
        email: DEFAULT_EMAIL,
        name: target.name || DEFAULT_NAME,
        passwordHash,
        role: 'SUPERADMIN',
      },
    })
    console.log(
      `Updated existing admin (id=${target.id}) with username=${DEFAULT_USERNAME} and password=${DEFAULT_PASSWORD}`,
    )
  } else {
    const created = await prisma.user.create({
      data: {
        userName: DEFAULT_USERNAME,
        email: DEFAULT_EMAIL,
        name: DEFAULT_NAME,
        lastName: '',
        img: '',
        role: 'SUPERADMIN',
        passwordHash,
      },
    })
    console.log(
      `Created admin user (id=${created.id}) with username=${DEFAULT_USERNAME} and password=${DEFAULT_PASSWORD}`,
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
