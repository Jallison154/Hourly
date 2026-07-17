import prisma from './prisma'

export async function writeAdminAudit(options: {
  adminSubject: string
  affectedUserId: string
  action: string
  previousValues?: unknown
  newValues?: unknown
}) {
  await prisma.adminAuditLog.create({
    data: {
      adminSubject: options.adminSubject,
      affectedUserId: options.affectedUserId,
      action: options.action,
      previousValues: options.previousValues
        ? JSON.stringify(options.previousValues)
        : null,
      newValues: options.newValues ? JSON.stringify(options.newValues) : null,
    },
  })
}
