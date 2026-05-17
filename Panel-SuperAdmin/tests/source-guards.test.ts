import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(process.cwd())

function read(rel: string): string {
  return readFileSync(path.join(root, rel), 'utf8')
}

test('audit forwarding has no empty catch block', () => {
  const src = read('src/services/admin-api/admin-api.client.ts')
  assert.equal(src.includes('} catch {'), false)
  assert.equal(src.includes('Audit log forwarding failed'), true)
})

test('login route uses generic invalid credentials response', () => {
  const src = read('src/app/api/auth/login/route.ts')
  assert.equal(src.includes("{ error: 'Invalid credentials' }"), true)
  assert.equal(src.includes('temporarily locked'), true)
})

test('panel auth uses isolated super_admin_session cookie', () => {
  const authSrc = read('src/lib/auth.ts')
  const middlewareSrc = read('src/middleware.ts')
  assert.equal(authSrc.includes("super_admin_session"), true)
  assert.equal(middlewareSrc.includes("super_admin_session"), true)
  assert.equal(authSrc.includes("sa_token"), false)
})

test('tenant update route does not log full payload body', () => {
  const src = read('src/app/api/tenants/[id]/route.ts')
  assert.equal(src.includes('payload: body'), false)
  assert.equal(src.includes('changes: sanitizedChanges'), true)
})

test('no backup middleware file remains inside src', () => {
  const oldBak = path.join(root, 'src', 'middleware.ts.bak.RUNTIME_HARDEN_20260516_140647')
  assert.equal(existsSync(oldBak), false)
  const movedBak = path.join(root, 'backups', 'middleware.ts.bak.RUNTIME_HARDEN_20260516_140647')
  assert.equal(existsSync(movedBak), true)
})

test('client panel auth uses its own cookie namespace (no shared super_admin_session)', () => {
  const clientLoginRoute = readFileSync(
    path.join(root, '..', 'medical-agenda-saas', 'src', 'app', 'api', 'auth', 'login', 'route.ts'),
    'utf8',
  )
  const clientServerAuth = readFileSync(
    path.join(root, '..', 'medical-agenda-saas', 'src', 'lib', 'server-auth.ts'),
    'utf8',
  )

  assert.equal(clientLoginRoute.includes('auth_token'), true)
  assert.equal(clientServerAuth.includes('auth_token'), true)
  assert.equal(clientLoginRoute.includes('super_admin_session'), false)
  assert.equal(clientServerAuth.includes('super_admin_session'), false)
})
