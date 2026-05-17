import bcrypt from 'bcryptjs'
import { promises as fs } from 'node:fs'
import path from 'node:path'

const CREDENTIALS_DIR = path.join(process.cwd(), '.runtime')
const CREDENTIALS_FILE = path.join(CREDENTIALS_DIR, 'super-admin-credentials.json')

interface StoredCredentials {
  email: string
  passwordHash: string
  mustChangePassword: boolean
  updatedAt: string
}

function getBootstrapCredentials() {
  const email = (process.env.SUPER_ADMIN_EMAIL ?? '').trim().toLowerCase()
  const plainPassword = process.env.SUPER_ADMIN_PASSWORD ?? ''
  const passwordHash = (process.env.SUPER_ADMIN_PASSWORD_HASH ?? '').trim()
  return { email, plainPassword, passwordHash }
}

async function readStoredCredentials(): Promise<StoredCredentials | null> {
  try {
    const raw = await fs.readFile(CREDENTIALS_FILE, 'utf8')
    const parsed = JSON.parse(raw) as Partial<StoredCredentials>

    if (
      typeof parsed.email === 'string' &&
      typeof parsed.passwordHash === 'string' &&
      typeof parsed.mustChangePassword === 'boolean' &&
      typeof parsed.updatedAt === 'string'
    ) {
      return {
        email: parsed.email.toLowerCase().trim(),
        passwordHash: parsed.passwordHash,
        mustChangePassword: parsed.mustChangePassword,
        updatedAt: parsed.updatedAt,
      }
    }

    return null
  } catch {
    return null
  }
}

async function writeStoredCredentials(input: StoredCredentials): Promise<void> {
  await fs.mkdir(CREDENTIALS_DIR, { recursive: true })
  await fs.writeFile(CREDENTIALS_FILE, JSON.stringify(input, null, 2), 'utf8')
}

export async function validateSuperAdminCredentials(
  email: string,
  password: string,
): Promise<{ id: string; email: string; mustChangePassword: boolean } | null> {
  const normalizedEmail = email.toLowerCase().trim()
  const stored = await readStoredCredentials()

  if (stored) {
    if (normalizedEmail !== stored.email) return null
    const validStored = await bcrypt.compare(password, stored.passwordHash)
    if (!validStored) return null

    return {
      id: 'bootstrap-super-admin',
      email: stored.email,
      mustChangePassword: stored.mustChangePassword,
    }
  }

  const bootstrap = getBootstrapCredentials()
  if (!bootstrap.email) return null
  if (normalizedEmail !== bootstrap.email) return null
  const plainMatch = bootstrap.plainPassword ? password === bootstrap.plainPassword : false
  const hashMatch = bootstrap.passwordHash
    ? await bcrypt.compare(password, bootstrap.passwordHash)
    : false
  if (!plainMatch && !hashMatch) return null

  return {
    id: 'bootstrap-super-admin',
    email: bootstrap.email,
    mustChangePassword: true,
  }
}

export async function changeSuperAdminPassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const stored = await readStoredCredentials()
  const bootstrap = getBootstrapCredentials()

  const targetEmail = (stored?.email ?? bootstrap.email).toLowerCase().trim()
  const currentHash = stored?.passwordHash ?? bootstrap.passwordHash

  if (!targetEmail || !currentHash) {
    return { ok: false, error: 'Super admin credentials are not configured' }
  }

  const plainMatch = stored ? false : (bootstrap.plainPassword ? currentPassword === bootstrap.plainPassword : false)
  const hashMatch = await bcrypt.compare(currentPassword, currentHash)
  const validCurrent = plainMatch || hashMatch
  if (!validCurrent) {
    return { ok: false, error: 'Current password is incorrect' }
  }

  const samePassword = await bcrypt.compare(newPassword, currentHash)
  if (samePassword) {
    return { ok: false, error: 'New password must be different from current password' }
  }

  const newHash = await bcrypt.hash(newPassword, 12)
  await writeStoredCredentials({
    email: targetEmail,
    passwordHash: newHash,
    mustChangePassword: false,
    updatedAt: new Date().toISOString(),
  })

  return { ok: true }
}
