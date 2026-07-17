import prisma from './prisma'

/** Returns an error message if the user's period is locked/approved and edits are blocked. */
export async function assertEditablePeriod(
  userId: string,
  clockIn: Date
): Promise<string | null> {
  const sheet = await prisma.timesheet.findFirst({
    where: {
      userId,
      periodStart: { lte: clockIn },
      periodEnd: { gte: clockIn },
      status: { in: ['SUBMITTED', 'APPROVED', 'LOCKED'] },
    },
  })
  if (!sheet) return null
  if (sheet.status === 'LOCKED') {
    return 'This pay period is locked. Submit a correction request or ask an administrator to reopen it.'
  }
  if (sheet.status === 'APPROVED') {
    return 'This timesheet is approved. Submit a correction request to change entries.'
  }
  if (sheet.status === 'SUBMITTED') {
    return 'This timesheet is submitted for approval. Withdraw it before editing, or wait for review.'
  }
  return null
}
