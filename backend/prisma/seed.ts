import { PrismaClient, Prisma } from '@prisma/client'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  // Roles are enum; create admin user if not exists
  const adminEmail = 'admin@example.com'
  const admin = await prisma.user.findUnique({ where: { email: adminEmail } })
  if (!admin) {
    await prisma.user.create({
      data: {
        userName: 'admin',
        name: 'Admin',
        email: adminEmail,
        img: '',
        role: 'SUPERADMIN',
        passwordHash: await bcrypt.hash('admin123', 10),
      },
    })
    console.log('Seeded admin user: admin/admin123')
  }

  // Users demo
  const demoUsers = [
    { userName: 'alice', name: 'Alice Johnson', email: 'alice@example.com', img: '/img/avatars/thumb-1.jpg' },
    { userName: 'bob', name: 'Bob Smith', email: 'bob@example.com', img: '/img/avatars/thumb-2.jpg' },
    { userName: 'carol', name: 'Carol White', email: 'carol@example.com', img: '/img/avatars/thumb-3.jpg' },
    { userName: 'dave', name: 'Dave Brown', email: 'dave@example.com', img: '/img/avatars/thumb-4.jpg' },
  ]
  for (const u of demoUsers) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, role: 'USER', passwordHash: await bcrypt.hash('password', 10) },
    })
  }

  // Order statuses
  const oStatuses = [
    { code: 0, name: 'Pending', color: '#9ca3af' },
    { code: 1, name: 'Processing', color: '#3b82f6' },
    { code: 2, name: 'Shipped', color: '#8b5cf6' },
    { code: 3, name: 'Completed', color: '#16a34a' },
    { code: 4, name: 'Cancelled', color: '#ef4444' },
  ]
  for (const s of oStatuses) {
    await prisma.orderStatus.upsert({
      where: { code: s.code },
      update: { name: s.name, color: s.color },
      create: s,
    })
  }

  // Payment methods
  const methods = ['Cash', 'Credit Card', 'Wire']
  for (const m of methods) {
    await prisma.paymentMethod.upsert({
      where: { name: m },
      update: {},
      create: { name: m },
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
    { name: 'Active', color: '#10b981' },
    { name: 'Onboarding', color: '#2563eb' },
    { name: 'Churn Risk', color: '#f59e0b' },
    { name: 'Inactive', color: '#6b7280' },
  ]
  const customerStatusMap = new Map<string, number>()
  for (const status of customerStatuses) {
    const record = await prisma.customerStatus.upsert({
      where: { name: status.name },
      update: { color: status.color },
      create: status,
    })
    customerStatusMap.set(status.name, record.id)
  }
  const activeCustomerStatusId = customerStatusMap.get('Active') ?? null

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
  const users = await prisma.user.findMany({ where: { email: { not: adminEmail } } })
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

  // Backfill payment methods randomly for orders without one
  const methodsAll = await prisma.paymentMethod.findMany()
  if (methodsAll.length === 0) {
    const defaults = ['Cash', 'Credit Card', 'Wire']
    for (const m of defaults) {
      await prisma.paymentMethod.upsert({ where: { name: m }, update: {}, create: { name: m } })
    }
  }
  const pms = await prisma.paymentMethod.findMany()
  const ordersNoPm = await prisma.order.findMany({ where: { paymentMethodId: null }, select: { id: true } })
  for (const o of ordersNoPm) {
    const pm = pms[Math.floor(Math.random() * pms.length)]
    await prisma.order.update({ where: { id: o.id }, data: { paymentMethodId: pm.id } })
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
    const paymentMethod = pms.length > 0 ? pms[i % pms.length] : null
    await prisma.expense.create({
      data: {
        title: `Expense ${i + 1}`,
        description: 'Operational cost',
        amount: Math.round((50 + Math.random() * 450) * 100) / 100,
        date: new Date(Date.now() - i * 86400000),
        currency,
        categoryId: eCats[i % eCats.length]?.id,
        statusId: expenseStatusId ?? undefined,
        paymentMethodId: paymentMethod?.id,
      },
    })
  }

  // Notifications
  const anyUser = await prisma.user.findFirst({ where: { email: { not: adminEmail } } })
  for (let i = 0; i < 10; i++) {
    await prisma.notification.create({
      data: {
        recipientId: i % 2 === 0 ? anyUser?.id : null,
        target: '/app/sales/order-list',
        description: `Notification ${i + 1}`,
        type: i % 3,
        image: '',
        location: 'HQ',
        locationLabel: 'Office',
        status: 'info',
        readed: i % 4 === 0,
      },
    })
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
