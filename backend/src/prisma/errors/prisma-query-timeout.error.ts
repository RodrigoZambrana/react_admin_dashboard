export class PrismaQueryTimeoutError extends Error {
  constructor(public readonly timeoutMs: number, public readonly model?: string, public readonly action?: string) {
    super(`Prisma query timed out after ${timeoutMs}ms`)
    this.name = 'PrismaQueryTimeoutError'
  }
}
