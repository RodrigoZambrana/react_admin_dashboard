import {
  PrismaClient,
  Prisma,
  EmailCategory,
  Role,
  ProductType,
  SalesUnit,
  CmsEntryAssetType,
  CmsEntryStatus,
  NotificationEventType,
  NotificationAudience,
  NotificationChannel,
  NotificationDeliveryStatus,
} from '@prisma/client'
import * as bcrypt from 'bcrypt'
import { seedUruCortinasBaseline } from './baseline/seed-baseline'
import { seedUrucortinasPublicCmsContent } from './public-cms-content'
import { seedMarketingCmsPages } from './seed-marketing-cms-pages'
import { listSeedPaymentMethods } from './shared/payment-methods'
import { runMultiEnvironmentSeeds } from './seeds'

const prisma = new PrismaClient()

const SUPERADMIN_EMAIL = process.env.SEED_SUPERADMIN_EMAIL || ''
const SUPERADMIN_PASSWORD = process.env.SEED_SUPERADMIN_PASSWORD || ''
const SUPERADMIN_NAME =
  process.env.SEED_SUPERADMIN_NAME ||
  process.env.SEED_SUPERADMIN_FIRST_NAME ||
  'Super Admin'
const SUPERADMIN_LAST_NAME = process.env.SEED_SUPERADMIN_LAST_NAME || ''
const ENABLE_DEMO_SEED = process.env.ENABLE_DEMO_SEED === 'true'
const DEMO_PASSWORD = process.env.SEED_USER_PASSWORD || 'User@123!'

function maskSecret(value: string) {
  if (!value) return '(empty)'
  if (value.length <= 4) return '****'
  return `${value[0]}***${value[value.length - 1]}`
}

type StandardSizeSeed = {
  widthM: number
  heightM: number
  sortOrder: number
}

const STANDARD_SIZE_SEED: StandardSizeSeed[] = [
  // Replace this list when the storefront needs a different standard-size grid.
  // Values are in meters because storefront m2 pricing works in meters.
  { widthM: 0.80, heightM: 1.00, sortOrder: 0 },
  { widthM: 1.00, heightM: 1.00, sortOrder: 1 },
  { widthM: 1.00, heightM: 1.20, sortOrder: 2 },
  { widthM: 1.00, heightM: 1.50, sortOrder: 3 },
  { widthM: 1.20, heightM: 1.00, sortOrder: 4 },
  { widthM: 1.20, heightM: 1.20, sortOrder: 5 },
  { widthM: 1.20, heightM: 1.50, sortOrder: 6 },
  { widthM: 1.20, heightM: 2.00, sortOrder: 7 },
  { widthM: 1.50, heightM: 1.00, sortOrder: 8 },
  { widthM: 1.50, heightM: 1.20, sortOrder: 9 },
  { widthM: 1.50, heightM: 1.50, sortOrder: 10 },
  { widthM: 1.50, heightM: 2.00, sortOrder: 11 },
  { widthM: 1.80, heightM: 1.00, sortOrder: 12 },
  { widthM: 1.80, heightM: 1.20, sortOrder: 13 },
  { widthM: 1.80, heightM: 1.50, sortOrder: 14 },
  { widthM: 1.80, heightM: 2.00, sortOrder: 15 },
  { widthM: 2.00, heightM: 1.20, sortOrder: 16 },
  { widthM: 2.00, heightM: 1.50, sortOrder: 17 },
  { widthM: 2.00, heightM: 2.00, sortOrder: 18 },
]

const formatStandardSizeLabel = (widthM: number, heightM: number) =>
  `${widthM.toFixed(2)} x ${heightM.toFixed(2)}`

async function seedStandardSizes() {
  if (STANDARD_SIZE_SEED.length === 0) {
    console.log('[seed] STANDARD_SIZE_SEED is empty; skipping StandardSize seed.')
    return
  }

  const desiredKeys = new Set(
    STANDARD_SIZE_SEED.map((size) => `${size.widthM.toFixed(2)}:${size.heightM.toFixed(2)}`),
  )

  const existingSizes = await prisma.standardSize.findMany({
    select: {
      id: true,
      width: true,
      height: true,
    },
  })

  for (const existing of existingSizes) {
    const key = `${Number(existing.width.toString()).toFixed(2)}:${Number(existing.height.toString()).toFixed(2)}`
    if (!desiredKeys.has(key)) {
      await prisma.standardSize.update({
        where: { id: existing.id },
        data: { isActive: false },
      })
    }
  }

  let upserted = 0

  for (const size of STANDARD_SIZE_SEED) {
    const width = new Prisma.Decimal(size.widthM.toFixed(4))
    const height = new Prisma.Decimal(size.heightM.toFixed(4))
    const label = formatStandardSizeLabel(size.widthM, size.heightM)

    await prisma.standardSize.upsert({
      where: {
        width_height: {
          width,
          height,
        },
      },
      update: {
        label,
        isActive: true,
        sortOrder: size.sortOrder,
      },
      create: {
        width,
        height,
        label,
        isActive: true,
        sortOrder: size.sortOrder,
      },
      select: { id: true },
    })
    upserted += 1
  }

  console.log(
    `[seed] StandardSize seeded: ${upserted} upserted, ${STANDARD_SIZE_SEED.length} active.`,
  )
}

async function seedSuperAdmin() {
  if (!SUPERADMIN_EMAIL || !SUPERADMIN_PASSWORD) {
    console.log(
      '[seed] Skipping superadmin creation: SEED_SUPERADMIN_EMAIL / SEED_SUPERADMIN_PASSWORD not provided.',
    )
    return null
  }

  const normalizedEmail = SUPERADMIN_EMAIL.trim().toLowerCase()
  const existing = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  })
  if (existing) {
    console.log(`[seed] Superadmin already exists for ${normalizedEmail}`)
    return existing
  }

  const hashed = await bcrypt.hash(SUPERADMIN_PASSWORD, 12)
  const created = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: SUPERADMIN_NAME.trim(),
      lastName: SUPERADMIN_LAST_NAME.trim() || undefined,
      img: '',
      role: 'SUPERADMIN',
      passwordHash: hashed,
    },
  })

  console.log(
    `[seed] Superadmin account created for ${normalizedEmail}. (password: ${maskSecret(
      SUPERADMIN_PASSWORD,
    )})`,
  )

  // Clear sensitive env variables to reduce accidental reuse
  delete process.env.SEED_SUPERADMIN_PASSWORD
  return created
}

async function seedDemoData(superAdminEmail?: string) {
  if (!ENABLE_DEMO_SEED) {
    console.log('[seed] Demo data disabled (ENABLE_DEMO_SEED != "true").')
    return
  }

  console.log('[seed] Seeding demo data...')

  const demoUsers = [
    { name: 'Alice Johnson', email: 'alice@example.com', img: '/img/avatars/thumb-1.jpg' },
    { name: 'Bob Smith', email: 'bob@example.com', img: '/img/avatars/thumb-2.jpg' },
    { name: 'Carol White', email: 'carol@example.com', img: '/img/avatars/thumb-3.jpg' },
    { name: 'Dave Brown', email: 'dave@example.com', img: '/img/avatars/thumb-4.jpg' },
  ]
  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, role: 'USER', passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10) },
    })
  }

  // Shipping options
  const shippingOptions = [
    {
      name: 'FedEx',
      deliveryFees: 18.5,
      estimatedMin: 2,
      estimatedMax: 5,
      img: '/img/shipping/fedex.png',
    },
    {
      name: 'DHL',
      deliveryFees: 22,
      estimatedMin: 3,
      estimatedMax: 6,
      img: '/img/shipping/dhl.png',
    },
    {
      name: 'UPS',
      deliveryFees: 16,
      estimatedMin: 4,
      estimatedMax: 7,
      img: '/img/shipping/ups.png',
    },
  ]
  for (const option of shippingOptions) {
    await prisma.shippingOption.upsert({
      where: { name: option.name },
      update: {
        deliveryFees: option.deliveryFees,
        estimatedMin: option.estimatedMin,
        estimatedMax: option.estimatedMax,
        img: option.img,
      },
      create: option,
    })
  }

  // Product categories
  const categories = ['devices', 'bags', 'shoes', 'watches', 'cloths']
  for (const c of categories) {
    await prisma.productCategory.upsert({
      where: { name: c },
      update: {},
      create: { name: c },
    })
  }

  await prisma.systemConfig.upsert({
    where: { key: 'taxRate' },
    update: { value: '22' },
    create: { key: 'taxRate', value: '22' },
  })

  await prisma.systemConfig.upsert({
    where: { key: 'orderMinimumDeposit' },
    update: { value: JSON.stringify({ type: 'PERCENTAGE', value: 30 }) },
    create: { key: 'orderMinimumDeposit', value: JSON.stringify({ type: 'PERCENTAGE', value: 30 }) },
  })

  const defaultEventTypes = [
    { key: 'meeting', label: 'Meeting' },
    { key: 'task', label: 'Task' },
    { key: 'workshop', label: 'Workshop' },
    { key: 'other', label: 'Other' },
  ]

  await prisma.systemConfig.upsert({
    where: { key: 'calendarEventTypes' },
    update: { value: JSON.stringify(defaultEventTypes) },
    create: {
      key: 'calendarEventTypes',
      value: JSON.stringify(defaultEventTypes),
    },
  })

  // Expense statuses and categories
  const eStatuses = [
    { name: 'New', color: '#3b82f6' },
    { name: 'Approved', color: '#10b981' },
    { name: 'Rejected', color: '#ef4444' },
  ]
  for (const s of eStatuses) {
    await prisma.expenseStatus.upsert({
      where: { name: s.name },
      update: { color: s.color },
      create: s,
    })
  }
  const eCategories = ['Operations', 'Marketing', 'Salaries']
  for (const c of eCategories) {
    await prisma.expenseCategory.upsert({
      where: { name: c },
      update: {},
      create: { name: c },
    })
  }

  const customerStatuses = [
    { name: 'Activo', color: '#10b981' },
    { name: 'Suspendido', color: '#f59e0b' },
    { name: 'Bloqueado', color: '#ef4444' },
  ]
  const customerStatusMap = new Map<string, number>()
  for (const status of customerStatuses) {
    const existing = await prisma.customerStatus.findFirst({
      where: { name: { in: [status.name, status.name === 'Activo' ? 'Active' : status.name] } },
    })
    const record = existing
      ? await prisma.customerStatus.update({
          where: { id: existing.id },
          data: { color: status.color },
        })
      : await prisma.customerStatus.create({ data: status })
    customerStatusMap.set(status.name, record.id)
  }
  const activeCustomerStatusId = customerStatusMap.get('Activo') ?? null

  // Customers
 const customers = [
    {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      location: 'NA',
      title: 'Owner',
      img: '/img/avatars/thumb-1.jpg',
      phones: ['+1 202 555 0162', '+1 202 555 0100'],
    },
    {
      firstName: 'Jane',
      lastName: 'Cooper',
      email: 'jane@example.com',
      location: 'EU',
      title: 'Manager',
      img: '/img/avatars/thumb-2.jpg',
      phones: ['+44 20 7946 0958'],
    },
    {
      firstName: 'Carlos',
      lastName: 'Ruiz',
      email: 'carlos@example.com',
      location: 'LATAM',
      title: 'CTO',
      img: '/img/avatars/thumb-3.jpg',
      phones: ['+52 55 5342 1456', '+52 55 1234 5678'],
    },
    {
      firstName: 'Akira',
      lastName: 'Tanaka',
      email: 'akira@example.com',
      location: 'APAC',
      title: 'CEO',
      img: '/img/avatars/thumb-4.jpg',
      phones: ['+81 3 6384 9000'],
    },
    {
      firstName: 'Amina',
      lastName: 'Youssef',
      email: 'amina@example.com',
      location: 'MEA',
      title: 'CFO',
      img: '/img/avatars/thumb-5.jpg',
      phones: ['+971 4 123 4567'],
    },
  ]
  for (const c of customers) {
    const found = await prisma.customer.findFirst({
      where: { email: c.email },
      select: { id: true, statusId: true },
    })
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ')
    const [primaryPhone] = c.phones || []
    const customerPayload = {
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      location: c.location,
      title: c.title,
      img: c.img,
      name,
      phoneNumber: primaryPhone,
    }
    const statusId = found?.statusId ?? activeCustomerStatusId ?? undefined
    if (statusId !== undefined && statusId !== null) {
      Object.assign(customerPayload, { statusId })
    }
    const customer = found
      ? await prisma.customer.update({ where: { id: found.id }, data: customerPayload })
      : await prisma.customer.create({ data: customerPayload })
    if (customer.id) {
      await prisma.customerPhone.deleteMany({ where: { customerId: customer.id } })
      if (c.phones && c.phones.length) {
        await prisma.customerPhone.createMany({
          data: c.phones.map((phone, index) => ({
            customerId: customer.id,
            phone,
            isPrimary: index === 0,
          })),
        })
      }
    }
    const addrExists = await prisma.customerAddress.findFirst({ where: { customerId: customer.id } })
    if (!addrExists) {
      await prisma.customerAddress.create({
        data: {
          customerId: customer.id,
          street: 'Main St',
          number: '123',
          corner: '2nd Ave',
          apartment: '1A',
          city: 'Sample City',
          country: 'USA',
          isPrimary: true,
        },
      })
    }
  }

  // Products
  const markup = 1.3
  const roundCurrency = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100
  const prods = [
    { name: 'Alpha Phone', category: 'devices', salePrice: 699, stock: 30, status: 0, img: '/img/products/product-1.jpg' },
    { name: 'Beta Laptop', category: 'devices', salePrice: 1199, stock: 20, status: 0, img: '/img/products/product-2.jpg' },
    { name: 'Gamma Watch', category: 'watches', salePrice: 199, stock: 42, status: 1, img: '/img/products/product-3.jpg' },
    { name: 'Delta Shoes', category: 'shoes', salePrice: 89, stock: 60, status: 0, img: '/img/products/product-4.jpg' },
    { name: 'Epsilon Backpack', category: 'bags', salePrice: 49, stock: 80, status: 0, img: '/img/products/product-5.jpg' },
  ]
  const categoriesMap = new Map<string, number>()
  const catsDb = await prisma.productCategory.findMany()
  catsDb.forEach((c) => categoriesMap.set(c.name, c.id))
  for (const p of prods) {
    const found = await prisma.product.findFirst({ where: { name: p.name } })
    const costPrice = roundCurrency(p.salePrice / markup)
    if (found) {
      await prisma.product.update({
        where: { id: found.id },
        data: {
          salePrice: p.salePrice,
          costPrice,
          stock: p.stock,
          status: p.status,
          img: p.img,
          categoryId: categoriesMap.get(p.category),
          costPerItem: costPrice,
        },
      })
    } else {
      await prisma.product.create({
        data: {
          name: p.name,
          salePrice: p.salePrice,
          costPrice,
          costPerItem: costPrice,
          stock: p.stock,
          status: p.status,
          img: p.img,
          categoryId: categoriesMap.get(p.category),
          published: true,
          tags: ['new'],
        },
      })
    }
  }

  // Projects
  const prj = await prisma.project.createMany({
    data: [
      { name: 'Octonine POS', code: 'Backend Application', description: 'Retail POS backend services' },
      { name: 'Evo SaaS API', code: 'Backend Services', description: 'Multi-tenant SaaS API' },
      { name: 'Posiflex Web', code: 'Frontend Web Application', description: 'Portal front-end' },
    ],
    skipDuplicates: true,
  })
  const projects = await prisma.project.findMany()

  // Tasks with assignees
  const users = await prisma.user.findMany({
    where: {
      email: {
        notIn: [superAdminEmail || '', SUPERADMIN_EMAIL].filter(Boolean),
      },
    },
  })
  const someTasks = [
    { subject: 'Design DB schema', description: 'Initial ERD', priority: 0, status: 'open' },
    { subject: 'Implement Auth', description: 'JWT login & roles', priority: 1, status: 'in_progress' },
    { subject: 'Setup CI/CD', description: 'Pipeline for deploy', priority: 2, status: 'done' },
    { subject: 'Payment integration', description: 'Stripe', priority: 1, status: 'open' },
  ]
  for (const p of projects) {
    for (const t of someTasks) {
      const task = await prisma.task.create({
        data: {
          subject: `${p.name}: ${t.subject}`,
          description: t.description,
          priority: t.priority,
          status: t.status,
          projectId: p.id,
          dueDate: new Date(Date.now() + Math.random() * 20 * 86400000),
        },
      })
      const assignees = users.sort(() => 0.5 - Math.random()).slice(0, 2)
      for (const u of assignees) {
        await prisma.taskAssignee.create({ data: { taskId: task.id, userId: u.id } })
      }
    }
  }

  // Activities board
  const activityColumns = [
    { title: 'Backlog', sortOrder: 0 },
    { title: 'In Progress', sortOrder: 1 },
    { title: 'Review', sortOrder: 2 },
    { title: 'Done', sortOrder: 3 },
  ]

  for (const column of activityColumns) {
    await prisma.activityColumn.upsert({
      where: { title: column.title },
      update: { sortOrder: column.sortOrder },
      create: column,
    })
  }

  const boardColumns = await prisma.activityColumn.findMany({ orderBy: { sortOrder: 'asc' } })
  const activityMembers = await prisma.user.findMany({ take: 3 })

  for (const [index, column] of boardColumns.entries()) {
    const existingTickets = await prisma.activityTicket.count({ where: { columnId: column.id } })
    if (existingTickets > 0) continue
    const ticketCount = index === boardColumns.length - 1 ? 2 : 3
    for (let i = 0; i < ticketCount; i++) {
      const ticket = await prisma.activityTicket.create({
        data: {
          columnId: column.id,
          name: `${column.title} task ${i + 1}`,
          description: `Seeded ticket ${i + 1} in ${column.title}`,
          priority: index % 2 === 0 ? 'High priority' : 'Medium priority',
          labels: index % 2 === 0 ? ['backend'] : ['frontend'],
          dueDate: new Date(Date.now() + (i + 1) * 86400000),
          order: i,
        },
      })
      for (const member of activityMembers) {
        await prisma.activityTicketMember.upsert({
          where: { ticketId_userId: { ticketId: ticket.id, userId: member.id } },
          update: {},
          create: { ticketId: ticket.id, userId: member.id },
        })
      }
    }
  }

  // Calendar events
  const allTasks = await prisma.task.findMany()
  const dbCustomers = await prisma.customer.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      name: true,
      email: true,
    },
  })
  const colorMap: Record<string, string> = {
    meeting: 'blue',
    task: 'emerald',
    workshop: 'purple',
    other: 'indigo',
  }

  for (let i = 0; i < 12; i++) {
    const day = new Date(Date.now() + i * 86400000)
    const typeEnum = i % 3 === 0 ? 'MEETING' : i % 3 === 1 ? 'TASK' : 'OTHER'
    const typeKeyMap: Record<string, string> = {
      MEETING: 'meeting',
      TASK: 'task',
      WORKSHOP: 'workshop',
      OTHER: 'other',
    }
    const typeKey = typeKeyMap[typeEnum] || 'other'
    const address = {
      street: 'HQ Main Ave',
      number: String(100 + i),
      city: 'Montevideo',
      country: 'UY',
      corner: null as string | null,
      apartment: null as string | null,
    }
    const assignedCustomer = dbCustomers.length
      ? dbCustomers[i % dbCustomers.length]
      : null
    const metadata: Prisma.JsonObject = {
      address,
      customType: typeKey,
    }
    if (assignedCustomer) {
      metadata.customerId = assignedCustomer.id
      const fullName = [assignedCustomer.firstName, assignedCustomer.lastName]
        .filter(Boolean)
        .join(' ')
      const normalizedName = fullName || assignedCustomer.name || null
      if (normalizedName) {
        metadata.customerName = normalizedName
      }
      if (assignedCustomer.email) {
        metadata.customerEmail = assignedCustomer.email
      }
    }
    await prisma.calendarEvent.create({
      data: {
        title: `Event ${i + 1}`,
        type: typeEnum,
        startAt: day,
        endAt: new Date(day.getTime() + 2 * 3600000),
        allDay: false,
        location: `${address.street} ${address.number}, ${address.city}`,
        color: colorMap[typeKey] || 'indigo',
        metadata,
        taskId: i % 2 === 0 && allTasks[i % allTasks.length] ? allTasks[i % allTasks.length].id : null,
        projectId: projects[i % projects.length]?.id,
      },
    })
  }

  // Orders based on customers and products
  const dbProducts = await prisma.product.findMany()
  for (let i = 0; i < 10; i++) {
    const cust = dbCustomers[i % dbCustomers.length]
    const items = dbProducts
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map((p) => {
        const salePrice = Number(p.salePrice ?? 0)
        return {
          productId: p.id,
          name: p.name,
          price: salePrice,
          qty: 1 + Math.floor(Math.random() * 3),
          img: p.img,
        }
      })
    const subTotal = items.reduce((s, it) => s + it.price * it.qty, 0)
    const delivery = Math.round(Math.random() * 15 * 100) / 100
    const tax = Math.round(subTotal * 0.06 * 100) / 100
    const grandTotal = Math.round((subTotal + delivery + tax) * 100) / 100
    await prisma.order.create({
      data: {
        customerId: cust.id,
        date: new Date(Date.now() - i * 86400000),
        deliveryFees: delivery,
        subTotal,
        tax,
        grandTotal,
        items: { create: items },
      },
    })
  }

  // Backfill payment methods for orders without one using static catalog
  const paymentMethods = listSeedPaymentMethods()
  const paymentMethodIds = paymentMethods.map((method: { id: number }) => method.id)
  const fallbackPaymentMethodId = paymentMethodIds[0] ?? null
  if (fallbackPaymentMethodId !== null) {
    const ordersNoPm = await prisma.order.findMany({
      where: { paymentMethodId: null },
      select: { id: true },
    })
    for (const o of ordersNoPm) {
      const randomId =
        paymentMethodIds.length > 0
          ? paymentMethodIds[Math.floor(Math.random() * paymentMethodIds.length)]
          : fallbackPaymentMethodId
      await prisma.order.update({
        where: { id: o.id },
        data: { paymentMethodId: randomId },
      })
    }
  }

  // Expenses
  const eCats = await prisma.expenseCategory.findMany()
  const expenseStatusesRecords = await prisma.expenseStatus.findMany({ orderBy: { id: 'asc' } })
  const expenseStatusIds = expenseStatusesRecords.map((status) => status.id)
  const expenseCurrencies = ['UYU', 'USD', 'EUR']
  for (let i = 0; i < 20; i++) {
    const currency = expenseCurrencies[i % expenseCurrencies.length]
    const expenseStatusId =
      expenseStatusIds.length > 0
        ? expenseStatusIds[i % expenseStatusIds.length]
        : null
    const paymentMethodId =
      paymentMethodIds.length > 0 ? paymentMethodIds[i % paymentMethodIds.length] : null
    await prisma.expense.create({
      data: {
        title: `Expense ${i + 1}`,
        description: 'Operational cost',
        amount: Math.round((50 + Math.random() * 450) * 100) / 100,
        date: new Date(Date.now() - i * 86400000),
        currency,
        categoryId: eCats[i % eCats.length]?.id,
        statusId: expenseStatusId ?? undefined,
        paymentMethodId,
        taxCreditEligible: i % 4 !== 0,
      },
    })
  }

  // Notifications
  const anyUser = await prisma.user.findFirst({
    where: {
      email: {
        notIn: [superAdminEmail || '', SUPERADMIN_EMAIL].filter(Boolean),
      },
    },
  })
  for (let i = 0; i < 10; i++) {
    await prisma.notification.create({
      data: {
        eventType: NotificationEventType.ORDER_RECEIVED,
        audience: NotificationAudience.ADMIN,
        channel: NotificationChannel.IN_APP,
        deliveryStatus: NotificationDeliveryStatus.SENT,
        recipientId: i % 2 === 0 ? anyUser?.id ?? null : null,
        title: `Demo notification ${i + 1}`,
        body: 'This is a sample in-app notification generated by the seed script.',
        metadata: {
          demo: true,
          index: i,
          link: '/app/sales/order-list',
        },
        readed: i % 4 === 0,
        readAt: i % 4 === 0 ? new Date(Date.now() - i * 60_000) : null,
      },
    })
  }
}

async function seedBudgetProduct() {
  const budgetCategory = await prisma.productCategory.findFirst({
    where: { name: { in: ['cloths', 'devices'] } },
    select: { id: true },
  })

  const budgetProduct = {
    name: 'Cortinas Roller',
    productCode: 'cortinas-roller',
    img: '/uploads/cms/legacy-assets/img/portfolio/roller/cortinas_roller_3.jpeg',
    description: 'Producto semilla para el flujo de presupuesto m².',
    salePrice: 120,
    costPrice: 72,
    costPerItem: 72,
    stock: 100,
    status: 0,
    currency: 'UYU',
    unitOfMeasure: SalesUnit.SQUARE_METER,
    isBudgetCalculable: true,
    calculationStrategy: 'M2',
    productType: ProductType.PHYSICAL,
    published: true,
    tags: ['budget', 'm2'],
    categoryId: budgetCategory?.id ?? undefined,
  }

  const existing = await prisma.product.findFirst({
    where: {
      OR: [
        { productCode: budgetProduct.productCode },
        { name: budgetProduct.name },
      ],
    },
    select: { id: true },
  })

  if (existing) {
    await prisma.product.update({
      where: { id: existing.id },
      data: budgetProduct,
    })
    return
  }

  await prisma.product.create({
    data: budgetProduct,
  })
}

async function seedShowcaseProductImages() {
  const imageUpdates: Array<{ productCode: string; img: string; seoImageUrl: string }> = [
    {
      productCode: 'cortinas-roller',
      img: '/uploads/cms/legacy-assets/img/portfolio/roller/cortinas_roller_3.jpeg',
      seoImageUrl: '/uploads/cms/legacy-assets/img/portfolio/roller/cortinas_roller_3.jpeg',
    },
    {
      productCode: 'cortinas-tradicionales',
      img: '/uploads/cms/legacy-assets/img/portfolio/tradicionales/tradicionales_1.jpeg',
      seoImageUrl: '/uploads/cms/legacy-assets/img/portfolio/tradicionales/tradicionales_1.jpeg',
    },
    {
      productCode: 'cortinas-de-enrollar-pvc',
      img: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_1.jpeg',
      seoImageUrl: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_1.jpeg',
    },
    {
      productCode: 'cortinas-de-enrollar-aluminio',
      img: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_2.jpeg',
      seoImageUrl: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalana_2.jpeg',
    },
  ]

  for (const update of imageUpdates) {
    const existing = await prisma.product.findFirst({
      where: { productCode: update.productCode },
      select: { id: true },
    })

    if (!existing) continue

    await prisma.product.update({
      where: { id: existing.id },
      data: {
        img: update.img,
        seoImageUrl: update.seoImageUrl,
      },
    })
  }
}

async function seedDefaultOrderStatuses() {
  console.log('[seed] Order statuses are defined statically; skipping database seeding.')
}

async function seedCustomerStatuses() {
  const defaults = [
    { name: 'Activo', color: '#10B981' },
    { name: 'Suspendido', color: '#F59E0B' },
    { name: 'Bloqueado', color: '#EF4444' },
  ]

  for (const status of defaults) {
    const existing = await prisma.customerStatus.findFirst({
      where: { name: { in: [status.name, status.name === 'Activo' ? 'Active' : status.name] } },
      select: { id: true },
    })
    if (existing) {
      if (status.name === 'Activo') {
        await prisma.customerStatus.update({
          where: { id: existing.id },
          data: { color: status.color },
        })
      }
      continue
    }

    await prisma.customerStatus.create({
      data: status,
    })
  }
}

async function seedEmailSettings() {
  const categories = [EmailCategory.ORDERS, EmailCategory.PAYMENTS, EmailCategory.AUTH]
  const defaultFromAddress = process.env.EMAIL_FROM_DEFAULT || 'no-reply@example.com'
  const defaultFromName = process.env.EMAIL_FROM_NAME_DEFAULT || 'Sistema Administrativo'
  for (const category of categories) {
    const existing = await prisma.emailSetting.findUnique({ where: { category } })
    if (!existing) {
      await prisma.emailSetting.create({
        data: {
          category,
          fromAddress: defaultFromAddress,
          fromName: defaultFromName,
          enabled: true,
        },
      })
    }
  }
  const adminRule = await prisma.roleNotificationRule.findFirst({ where: { role: Role.ADMIN } })
  if (!adminRule) {
    await prisma.roleNotificationRule.create({
      data: {
        role: Role.ADMIN,
        categories,
        enabled: true,
      },
    })
  }
}

async function seedCmsSections() {
  const defaults = [
    {
      key: 'HOME_STORIES',
      name: 'Home Stories',
      description: 'Stories destacadas del home storefront.',
      sortOrder: 0,
      isActive: true,
    },
    {
      key: 'HOME_HIGHLIGHTS',
      name: 'Atención comercial',
      description: 'Visitas, pagos y garantía destacados del home storefront.',
      sortOrder: 10,
      isActive: true,
    },
  ]

  for (const section of defaults) {
    await prisma.cmsSection.upsert({
      where: { key: section.key },
      update: {
        name: section.name,
        description: section.description,
        sortOrder: section.sortOrder,
        isActive: section.isActive,
      },
      create: section,
    })
  }
}

async function seedCmsEntries() {
  const now = new Date()
  const storiesSection = await prisma.cmsSection.findUnique({
    where: { key: 'HOME_STORIES' },
    select: { id: true },
  })
  const section = await prisma.cmsSection.findUnique({
    where: { key: 'HOME_HIGHLIGHTS' },
    select: { id: true },
  })

  if (!storiesSection && !section) {
    return
  }

  if (storiesSection) {
    const storyDefaults = [
      {
        slug: 'home-story-cortinas-roller',
        title: 'Cortinas Roller',
        subtitle: 'Interior moderno y funcional',
        description:
          'Solución interior para regular luz y privacidad con una estética limpia en hogar u oficina.',
        priority: 30,
        ctaLabel: 'Ver cortinas roller',
        ctaUrl: '/productos/cortinas-roller.html',
        thumbnailUrl: '/uploads/cms/legacy-assets/img/portfolio/roller/rollers.png',
        assets: [
          {
            title: 'Cortinas Roller',
            caption: 'Soluciones para ambientes que necesitan control de luz y un acabado limpio.',
            mediaType: CmsEntryAssetType.IMAGE,
            mediaUrl: '/uploads/cms/legacy-assets/img/portfolio/roller/rollers.png',
            posterUrl: '/uploads/cms/legacy-assets/img/portfolio/roller/rollers.png',
            sortOrder: 0,
          },
        ],
      },
      {
        slug: 'home-story-cortinas-enrollar',
        title: 'Cortinas de enrollar',
        subtitle: 'PVC o aluminio',
        description:
          'Persianas en PVC o aluminio con opción manual o motorizada según uso, exposición y mantenimiento.',
        priority: 20,
        ctaLabel: 'Ver cortinas de enrollar',
        ctaUrl: '/productos/cortinas-de-enrollar.html',
        thumbnailUrl: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalanas.png',
        assets: [
          {
            title: 'Cortinas de enrollar',
            caption: 'Una opción práctica para hogares, comercios y frentes expuestos.',
            mediaType: CmsEntryAssetType.IMAGE,
            mediaUrl: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalanas.png',
            posterUrl: '/uploads/cms/legacy-assets/img/portfolio/catalanas/catalanas.png',
            sortOrder: 0,
          },
        ],
      },
      {
        slug: 'home-story-bandas-verticales',
        title: 'Bandas verticales',
        subtitle: 'Ventanales amplios',
        description:
          'Versatilidad y elegancia para oficinas, living y ventanales amplios con control de luz.',
        priority: 15,
        ctaLabel: 'Ver bandas verticales',
        ctaUrl: '/productos/bandas-verticales.html',
        thumbnailUrl: '/uploads/cms/legacy-assets/img/portfolio/bandas_verticales/bandas_verticales_3.jpeg',
        assets: [
          {
            title: 'Bandas verticales',
            caption: 'Ideales para ventanales amplios, oficinas y living.',
            mediaType: CmsEntryAssetType.IMAGE,
            mediaUrl: '/uploads/cms/legacy-assets/img/portfolio/bandas_verticales/bandas_verticales_3.jpeg',
            posterUrl: '/uploads/cms/legacy-assets/img/portfolio/bandas_verticales/bandas_verticales_3.jpeg',
            sortOrder: 0,
          },
        ],
      },
      {
        slug: 'home-story-venecianas',
        title: 'Cortinas Venecianas',
        subtitle: 'Lamas 16 mm y 25 mm',
        description:
          'Control de luz y privacidad con una terminación limpia para dormitorios, oficinas y espacios de uso diario.',
        priority: 12,
        ctaLabel: 'Ver venecianas',
        ctaUrl: '/productos/venecianas.html',
        thumbnailUrl: '/uploads/cms/legacy-assets/img/portfolio/venecianas/cortina_veneciana_4.jpeg',
        assets: [
          {
            title: 'Cortinas Venecianas',
            caption: 'Lamas de 16 mm y 25 mm para controlar luz y privacidad.',
            mediaType: CmsEntryAssetType.IMAGE,
            mediaUrl: '/uploads/cms/legacy-assets/img/portfolio/venecianas/cortina_veneciana_4.jpeg',
            posterUrl: '/uploads/cms/legacy-assets/img/portfolio/venecianas/cortina_veneciana_4.jpeg',
            sortOrder: 0,
          },
        ],
      },
      {
        slug: 'home-story-aberturas-aluminio',
        title: 'Aberturas en aluminio',
        subtitle: 'Puertas, ventanas y DVH',
        description:
          'Una familia para obra y recambio con opciones de vidrio simple o doble vidriado hermético.',
        priority: 10,
        ctaLabel: 'Ver aberturas',
        ctaUrl: '/productos/aberturas-aluminio.html',
        thumbnailUrl: '/uploads/cms/legacy-assets/img/aberturas/images.jpg',
        assets: [
          {
            title: 'Aberturas en aluminio',
            caption: 'Soluciones de alto uso para hogares, comercios y proyectos a medida.',
            mediaType: CmsEntryAssetType.IMAGE,
            mediaUrl: '/uploads/cms/legacy-assets/img/aberturas/images.jpg',
            posterUrl: '/uploads/cms/legacy-assets/img/aberturas/images.jpg',
            sortOrder: 0,
          },
        ],
      },
      {
        slug: 'home-story-toldos-cerramientos',
        title: 'Toldos y cerramientos',
        subtitle: 'Protección solar exterior',
        description:
          'Toldos verticales, de brazo y cerramientos en PVC para sumar sombra, confort y uso exterior.',
        priority: 8,
        ctaLabel: 'Ver toldos',
        ctaUrl: '/productos/toldos-y-cerramientos.html',
        thumbnailUrl: '/uploads/cms/legacy-assets/img/portfolio/toldos/toldo.jpg',
        assets: [
          {
            title: 'Toldos y cerramientos',
            caption: 'Protección solar y solución exterior para distintos usos.',
            mediaType: CmsEntryAssetType.IMAGE,
            mediaUrl: '/uploads/cms/legacy-assets/img/portfolio/toldos/toldo.jpg',
            posterUrl: '/uploads/cms/legacy-assets/img/portfolio/toldos/toldo.jpg',
            sortOrder: 0,
          },
        ],
      },
      {
        slug: 'home-story-motores',
        title: 'Motores y automatismos',
        subtitle: 'Comodidad y uso diario',
        description:
          'Automatización para cortinas roller, persianas y cortinas metálicas con mayor confort diario.',
        priority: 5,
        ctaLabel: 'Ver motores',
        ctaUrl: '/productos/motores-cortinas-y-persianas.html',
        thumbnailUrl: '/uploads/cms/legacy-assets/img/portfolio/motores/persianas_motorizadas.jpg',
        assets: [
          {
            title: 'Motores y automatismos',
            caption: 'Automatización inteligente para más confort y uso diario.',
            mediaType: CmsEntryAssetType.IMAGE,
            mediaUrl: '/uploads/cms/legacy-assets/img/portfolio/motores/persianas_motorizadas.jpg',
            posterUrl: '/uploads/cms/legacy-assets/img/portfolio/motores/persianas_motorizadas.jpg',
            sortOrder: 0,
          },
        ],
      },
      {
        slug: 'home-story-cortinas-metalicas',
        title: 'Cortinas metálicas',
        subtitle: 'Seguridad para accesos',
        description: 'Máxima seguridad para locales y accesos con una línea pensada para uso intensivo.',
        priority: 3,
        ctaLabel: 'Ver cortinas metálicas',
        ctaUrl: '/productos/cortinas-metalicas.html',
        thumbnailUrl: '/uploads/cms/legacy-assets/img/portfolio/cortinas_metalicas/cortina_metalica_1.jpg',
        assets: [
          {
            title: 'Cortinas metálicas',
            caption: 'Máxima seguridad para locales y accesos.',
            mediaType: CmsEntryAssetType.IMAGE,
            mediaUrl: '/uploads/cms/legacy-assets/img/portfolio/cortinas_metalicas/cortina_metalica_1.jpg',
            posterUrl: '/uploads/cms/legacy-assets/img/portfolio/cortinas_metalicas/cortina_metalica_1.jpg',
            sortOrder: 0,
          },
        ],
      },
    ]

    for (const entry of storyDefaults) {
      const saved = await prisma.cmsEntry.upsert({
        where: {
          sectionId_locale_slug: {
            sectionId: storiesSection.id,
            locale: 'es',
            slug: entry.slug,
          },
        },
        update: {
          title: entry.title,
          subtitle: entry.subtitle,
          description: entry.description,
          status: CmsEntryStatus.PUBLISHED,
          priority: entry.priority,
          isActive: true,
          publishedAt: now,
          thumbnailUrl: entry.thumbnailUrl,
          ctaLabel: entry.ctaLabel,
          ctaUrl: entry.ctaUrl,
        },
        create: {
          sectionId: storiesSection.id,
          slug: entry.slug,
          locale: 'es',
          title: entry.title,
          subtitle: entry.subtitle,
          description: entry.description,
          status: CmsEntryStatus.PUBLISHED,
          priority: entry.priority,
          isActive: true,
          publishedAt: now,
          thumbnailUrl: entry.thumbnailUrl,
          ctaLabel: entry.ctaLabel,
          ctaUrl: entry.ctaUrl,
        },
        select: { id: true },
      })

      await prisma.cmsEntryAsset.deleteMany({ where: { entryId: saved.id } })
      await prisma.cmsEntryAsset.createMany({
        data: entry.assets.map((asset) => ({
          entryId: saved.id,
          title: asset.title,
          caption: asset.caption,
          mediaType: asset.mediaType,
          mediaUrl: asset.mediaUrl,
          posterUrl: asset.posterUrl,
          sortOrder: asset.sortOrder,
          isActive: true,
        })),
      })
    }
  }

  if (!section) {
    return
  }

  const defaults = [
    {
      slug: 'home-highlight-compra-segura',
      title: 'Visita y toma de medidas',
      subtitle: 'Acompañamiento comercial real',
      description:
        'Podemos coordinar una visita a domicilio para tomar medidas y orientar tu compra. En Montevideo la visita es sin costo.',
      priority: 30,
      ctaLabel: 'Solicitar visita',
      ctaUrl: '/contact',
      thumbnailUrl: '/uploads/cms/legacy-assets/img/servicios/reparacion-cortinas/1.jpeg',
      assets: [
        {
          title: 'Visita y toma de medidas',
          caption:
            'Coordinamos la visita a domicilio para tomar medidas y revisar el producto adecuado antes de avanzar.',
          mediaType: CmsEntryAssetType.IMAGE,
          mediaUrl: '/uploads/cms/legacy-assets/img/servicios/reparacion-cortinas/1.jpeg',
          posterUrl: '/uploads/cms/legacy-assets/img/servicios/reparacion-cortinas/1.jpeg',
          sortOrder: 0,
        },
      ],
    },
    {
      slug: 'home-highlight-entrega-coordinada',
      title: 'Pagos y garantía',
      subtitle: 'Medios de pago vigentes',
      description:
        'Aceptamos transferencia, efectivo, Mercado Pago y tarjetas. Con Mercado Pago se puede pagar en cuotas, y las cortinas de enrollar cuentan con garantía de 2 años.',
      priority: 20,
      ctaLabel: 'Ver formas de pago',
      ctaUrl: '/contact',
      thumbnailUrl: '/uploads/cms/legacy-assets/img/mercadopago-img.jpg',
      assets: [
        {
          title: 'Pagos y garantía',
          caption:
            'Formas de pago flexibles y garantía clara para cortinas de enrollar y soluciones afines.',
          mediaType: CmsEntryAssetType.IMAGE,
          mediaUrl: '/uploads/cms/legacy-assets/img/mercadopago-img.jpg',
          posterUrl: '/uploads/cms/legacy-assets/img/mercadopago-img.jpg',
          sortOrder: 0,
        },
      ],
    },
    {
      slug: 'home-highlight-reparacion',
      title: 'Reparación y mantenimiento',
      subtitle: 'Resolver antes de reemplazar',
      description:
        'Si el sistema todavía tiene arreglo, te orientamos sobre la reparación más conveniente.',
      priority: 10,
      ctaLabel: 'Solicitar reparación',
      ctaUrl: '/servicios/reparacion-cortinas-y-persianas.html',
      thumbnailUrl: '/uploads/cms/legacy-assets/img/servicios/reparacion-cortinas/1.jpeg',
      assets: [
        {
          title: 'Reparación y mantenimiento',
          caption:
            'Recuperá la operatividad con una intervención clara y enfocada en el uso diario.',
          mediaType: CmsEntryAssetType.IMAGE,
          mediaUrl: '/uploads/cms/legacy-assets/img/servicios/reparacion-cortinas/1.jpeg',
          posterUrl: '/uploads/cms/legacy-assets/img/servicios/reparacion-cortinas/1.jpeg',
          sortOrder: 0,
        },
      ],
    },
    {
      slug: 'home-highlight-trabajos-medida',
      title: 'Trabajos a medida',
      subtitle: 'Soluciones según el espacio',
      description:
        'Fabricamos y adaptamos la solución al espacio real, al tipo de abertura y al uso diario.',
      priority: 5,
      ctaLabel: 'Pedir presupuesto',
      ctaUrl: '/contacto.html',
      thumbnailUrl: '/uploads/cms/legacy-assets/img/intro-carousel/cerramiento-pvc.jpeg',
      assets: [
        {
          title: 'Trabajos a medida',
          caption: 'La solución se adapta al espacio real y al uso diario.',
          mediaType: CmsEntryAssetType.IMAGE,
          mediaUrl: '/uploads/cms/legacy-assets/img/intro-carousel/cerramiento-pvc.jpeg',
          posterUrl: '/uploads/cms/legacy-assets/img/intro-carousel/cerramiento-pvc.jpeg',
          sortOrder: 0,
        },
      ],
    },
  ]

  for (const entry of defaults) {
    const saved = await prisma.cmsEntry.upsert({
      where: {
        sectionId_locale_slug: {
          sectionId: section.id,
          locale: 'es',
          slug: entry.slug,
        },
      },
      update: {
        title: entry.title,
        subtitle: entry.subtitle,
        description: entry.description,
        status: CmsEntryStatus.PUBLISHED,
        priority: entry.priority,
        isActive: true,
        publishedAt: now,
        thumbnailUrl: entry.thumbnailUrl,
        ctaLabel: entry.ctaLabel,
        ctaUrl: entry.ctaUrl,
      },
      create: {
        sectionId: section.id,
        slug: entry.slug,
        locale: 'es',
        title: entry.title,
        subtitle: entry.subtitle,
        description: entry.description,
        status: CmsEntryStatus.PUBLISHED,
        priority: entry.priority,
        isActive: true,
        publishedAt: now,
        thumbnailUrl: entry.thumbnailUrl,
        ctaLabel: entry.ctaLabel,
        ctaUrl: entry.ctaUrl,
      },
      select: { id: true },
    })

    await prisma.cmsEntryAsset.deleteMany({ where: { entryId: saved.id } })
    await prisma.cmsEntryAsset.createMany({
      data: entry.assets.map((asset) => ({
        entryId: saved.id,
        title: asset.title,
        caption: asset.caption,
        mediaType: asset.mediaType,
        mediaUrl: asset.mediaUrl,
        posterUrl: asset.posterUrl,
        sortOrder: asset.sortOrder,
        isActive: true,
      })),
    })
  }
}

async function main() {
  await seedUruCortinasBaseline(prisma)
  const seedSummary = await runMultiEnvironmentSeeds(prisma)
  console.log(
    `[seed] environment=${seedSummary.environment} settings=${seedSummary.log.created} warnings=${seedSummary.warnings.length}`,
  )
  for (const warning of seedSummary.warnings) {
    console.warn(`[seed] ${warning}`)
  }
  await seedStandardSizes()
  await seedUrucortinasPublicCmsContent(prisma)
  await seedMarketingCmsPages(prisma)
  const superAdmin = await seedSuperAdmin()
  await seedCustomerStatuses()
  await seedBudgetProduct()
  await seedShowcaseProductImages()
  await seedDemoData(superAdmin?.email || SUPERADMIN_EMAIL)
  await seedDefaultOrderStatuses()
  await seedEmailSettings()
  await seedCmsSections()
  await seedCmsEntries()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
