import { PrismaClient } from '@prisma/client'
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

  // Product statuses
  const pStatuses = [
    { code: 0, name: 'In stock', color: '#16a34a' },
    { code: 1, name: 'Limited', color: '#f59e0b' },
    { code: 2, name: 'Out of stock', color: '#ef4444' },
  ]
  for (const s of pStatuses) {
    await prisma.productStatus.upsert({
      where: { code: s.code },
      update: { name: s.name, color: s.color },
      create: s,
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

  // Expense statuses and categories
  const eStatuses = ['New', 'Approved', 'Rejected']
  for (const s of eStatuses) {
    await prisma.expenseStatus.upsert({
      where: { name: s },
      update: {},
      create: { name: s },
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

  // Customers
 const customers = [
    { firstName: 'John', lastName: 'Doe', email: 'john@example.com', location: 'NA', title: 'Owner', phoneNumber: '+1 202 555 0162' },
    { firstName: 'Jane', lastName: 'Cooper', email: 'jane@example.com', location: 'EU', title: 'Manager', phoneNumber: '+44 20 7946 0958' },
    { firstName: 'Carlos', lastName: 'Ruiz', email: 'carlos@example.com', location: 'LATAM', title: 'CTO', phoneNumber: '+52 55 5342 1456' },
    { firstName: 'Akira', lastName: 'Tanaka', email: 'akira@example.com', location: 'APAC', title: 'CEO', phoneNumber: '+81 3 6384 9000' },
    { firstName: 'Amina', lastName: 'Youssef', email: 'amina@example.com', location: 'MEA', title: 'CFO', phoneNumber: '+971 4 123 4567' },
  ]
  for (const c of customers) {
    const found = await prisma.customer.findFirst({ where: { email: c.email } })
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ')
    const data = { ...c, name }
    const customer = found
      ? await prisma.customer.update({ where: { id: found.id }, data })
      : await prisma.customer.create({ data })
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
  const prods = [
    { name: 'Alpha Phone', category: 'devices', price: 699, stock: 30, status: 0, img: '/img/products/product-1.jpg' },
    { name: 'Beta Laptop', category: 'devices', price: 1199, stock: 20, status: 0, img: '/img/products/product-2.jpg' },
    { name: 'Gamma Watch', category: 'watches', price: 199, stock: 42, status: 1, img: '/img/products/product-3.jpg' },
    { name: 'Delta Shoes', category: 'shoes', price: 89, stock: 60, status: 0, img: '/img/products/product-4.jpg' },
    { name: 'Epsilon Backpack', category: 'bags', price: 49, stock: 80, status: 0, img: '/img/products/product-5.jpg' },
  ]
  const categoriesMap = new Map<string, number>()
  const catsDb = await prisma.productCategory.findMany()
  catsDb.forEach((c) => categoriesMap.set(c.name, c.id))
  for (const p of prods) {
    const found = await prisma.product.findFirst({ where: { name: p.name } })
    if (found) {
      await prisma.product.update({ where: { id: found.id }, data: { price: p.price, stock: p.stock, status: p.status, img: p.img, categoryId: categoriesMap.get(p.category) } })
    } else {
      await prisma.product.create({
        data: {
          name: p.name,
          price: p.price,
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

  // Calendar events
  const allTasks = await prisma.task.findMany()
  for (let i = 0; i < 12; i++) {
    const day = new Date(Date.now() + i * 86400000)
    await prisma.calendarEvent.create({
      data: {
        title: `Event ${i + 1}`,
        type: i % 3 === 0 ? 'MEETING' : i % 3 === 1 ? 'TASK' : 'OTHER',
        startAt: day,
        endAt: new Date(day.getTime() + 2 * 3600000),
        allDay: false,
        location: 'HQ',
        taskId: i % 2 === 0 && allTasks[i % allTasks.length] ? allTasks[i % allTasks.length].id : null,
        projectId: projects[i % projects.length]?.id,
      },
    })
  }

  // Orders based on customers and products
  const dbProducts = await prisma.product.findMany()
  const dbCustomers = await prisma.customer.findMany()
  for (let i = 0; i < 10; i++) {
    const cust = dbCustomers[i % dbCustomers.length]
    const items = dbProducts
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map((p) => ({ productId: p.id, name: p.name, price: p.price, qty: 1 + Math.floor(Math.random() * 3), img: p.img }))
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
  for (let i = 0; i < 20; i++) {
    await prisma.expense.create({
      data: {
        title: `Expense ${i + 1}`,
        description: 'Operational cost',
        amount: Math.round((50 + Math.random() * 450) * 100) / 100,
        date: new Date(Date.now() - i * 86400000),
        categoryId: eCats[i % eCats.length]?.id,
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
