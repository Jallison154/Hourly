import prisma from './prisma'

const DEFAULT_COMPANY_ID = 'default-company'

/** Ensure singleton company exists; return it. */
export async function getOrCreateDefaultCompany() {
  let company = await prisma.company.findFirst({ orderBy: { createdAt: 'asc' } })
  if (!company) {
    company = await prisma.company.create({
      data: {
        id: DEFAULT_COMPANY_ID,
        name: 'Hourly Company',
      },
    })
  }
  return company
}

export async function getCompanyForUser(companyId: string | null | undefined) {
  if (companyId) {
    const c = await prisma.company.findUnique({ where: { id: companyId } })
    if (c) return c
  }
  return getOrCreateDefaultCompany()
}
