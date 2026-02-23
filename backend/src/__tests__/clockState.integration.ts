/**
 * S-001 Clock state reliability: idempotent clock-in and clock-out.
 * Run with server up and test user: API_URL=http://localhost:5000/api TEST_EMAIL=... TEST_PASSWORD=... npx tsx src/__tests__/clockState.integration.ts
 */
const API_URL = process.env.API_URL || 'http://localhost:5000/api'
const TEST_EMAIL = process.env.TEST_EMAIL
const TEST_PASSWORD = process.env.TEST_PASSWORD

async function login(): Promise<string> {
  if (!TEST_EMAIL || !TEST_PASSWORD) throw new Error('Set TEST_EMAIL and TEST_PASSWORD')
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD })
  })
  if (!res.ok) throw new Error(`Login failed: ${res.status} ${await res.text()}`)
  const data = await res.json()
  if (!data.token) throw new Error('No token in login response')
  return data.token
}

async function clockIn(token: string): Promise<{ status: number; body: { id?: string } }> {
  const res = await fetch(`${API_URL}/time-entries/clock-in`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({})
  })
  const body = await res.json().catch(() => ({}))
  return { status: res.status, body }
}

async function clockOut(token: string): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${API_URL}/time-entries/clock-out`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({})
  })
  const body = await res.json().catch(() => null)
  return { status: res.status, body }
}

async function run() {
  console.log('Clock state integration test (S-001)')
  const token = await login()
  let firstId: string | undefined

  const r1 = await clockIn(token)
  if (r1.status !== 201) throw new Error(`First clock-in expected 201, got ${r1.status}`)
  firstId = r1.body.id
  if (!firstId) throw new Error('First clock-in response missing id')

  const r2 = await clockIn(token)
  if (r2.status !== 200) throw new Error(`Second clock-in (idempotent) expected 200, got ${r2.status}`)
  if (r2.body.id !== firstId) throw new Error(`Second clock-in expected same id ${firstId}, got ${r2.body.id}`)
  console.log('  idempotent clock-in: 200 + same entry')

  const r3 = await clockOut(token)
  if (r3.status !== 200) throw new Error(`First clock-out expected 200, got ${r3.status}`)

  const r4 = await clockOut(token)
  if (r4.status !== 200) throw new Error(`Second clock-out (idempotent) expected 200, got ${r4.status}`)
  console.log('  idempotent clock-out: 200')

  console.log('All S-001 clock state checks passed.')
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
