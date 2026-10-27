import { mkdirSync, existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID, randomBytes, scryptSync, createCipheriv, createDecipheriv } from 'node:crypto'

const collections = ['tasks', 'events', 'notes', 'messages', 'automations', 'audit', 'conversations']

export function blankState() {
  return Object.fromEntries(collections.map(name => [name, []]))
}

export function validateItem(kind, value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid item')
  const fields = {
    tasks: ['title', 'done'], events: ['title', 'at'], notes: ['title', 'body', 'source'],
    messages: ['title', 'body'], automations: ['title', 'enabled', 'intervalMinutes'],
  }
  if (!fields[kind]) throw new Error('Unknown collection')
  const result = Object.fromEntries(fields[kind].filter(field => value[field] !== undefined).map(field => [field, value[field]]))
  if (typeof result.title !== 'string' || !result.title.trim() || result.title.length > 200) throw new Error('Title must contain 1–200 characters')
  result.title = result.title.trim()
  for (const field of ['body', 'source']) if (result[field] !== undefined && (typeof result[field] !== 'string' || result[field].length > 20000)) throw new Error('Text is too long')
  if (kind === 'events' && (typeof result.at !== 'string' || !Number.isFinite(Date.parse(result.at)))) throw new Error('A valid event date is required')
  if (kind === 'tasks') {
    if (result.done !== undefined && typeof result.done !== 'boolean') throw new Error('Invalid task state')
    result.done ??= false
  }
  if (kind === 'automations') {
    if (result.enabled !== undefined && typeof result.enabled !== 'boolean') throw new Error('Invalid automation state')
    if (!Number.isInteger(result.intervalMinutes) || result.intervalMinutes < 1 || result.intervalMinutes > 1440) throw new Error('Interval must be 1–1440 minutes')
    result.enabled ??= false
  }
  return result
}

export function encryptBackup(state, password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) throw new Error('Use a backup password of 12–256 characters')
  const salt = randomBytes(16)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', scryptSync(password, salt, 32), iv)
  const data = Buffer.concat([cipher.update(JSON.stringify(state)), cipher.final()])
  return { version: 1, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: data.toString('base64') }
}

export function decryptBackup(backup, password) {
  if (!backup || backup.version !== 1 || typeof password !== 'string' || password.length < 12 || password.length > 256) throw new Error('Invalid backup or password')
  for (const field of ['salt', 'iv', 'tag', 'data']) if (typeof backup[field] !== 'string' || backup[field].length > 15000000) throw new Error('Invalid backup')
  const salt = Buffer.from(backup.salt, 'base64')
  const iv = Buffer.from(backup.iv, 'base64')
  const tag = Buffer.from(backup.tag, 'base64')
  if (salt.length !== 16 || iv.length !== 12 || tag.length !== 16) throw new Error('Invalid backup')
  const cipher = createDecipheriv('aes-256-gcm', scryptSync(password, salt, 32), iv)
  cipher.setAuthTag(tag)
  const state = JSON.parse(Buffer.concat([cipher.update(Buffer.from(backup.data, 'base64')), cipher.final()]).toString('utf8'))
  if (collections.some(name => !Array.isArray(state[name]))) throw new Error('Invalid backup collections')
  const clean = blankState()
  for (const name of ['tasks', 'events', 'notes', 'messages', 'automations']) {
    if (state[name].length > 10000) throw new Error('Backup contains too many items')
    clean[name] = state[name].map(item => ({ ...validateItem(name, item), id: randomUUID(), createdAt: new Date().toISOString() }))
  }
  for (const item of state.conversations.slice(-100)) {
    if (typeof item.prompt !== 'string' || item.prompt.length > 20000 || typeof item.answer !== 'string' || item.answer.length > 100000 || typeof item.at !== 'string' || !Number.isFinite(Date.parse(item.at))) throw new Error('Invalid conversation in backup')
    clean.conversations.push({ id: randomUUID(), prompt: item.prompt, answer: item.answer, at: item.at })
  }
  return clean
}

export function createStore(directory) {
  mkdirSync(directory, { recursive: true })
  const filename = join(directory, 'workspace.json')
  let state = existsSync(filename) ? JSON.parse(readFileSync(filename, 'utf8')) : blankState()
  function save() {
    const temporary = join(directory, `workspace-${randomUUID()}.tmp`)
    writeFileSync(temporary, JSON.stringify(state, null, 2), { mode: 0o600 })
    renameSync(temporary, filename)
  }
  function audit(action, kind) {
    state.audit.unshift({ id: randomUUID(), action, kind, at: new Date().toISOString() })
    state.audit = state.audit.slice(0, 1000)
  }
  return {
    read: () => structuredClone(state),
    add(kind, value) {
      if (state[kind]?.length >= 10000) throw new Error('Collection is full')
      const item = { ...validateItem(kind, value), id: randomUUID(), createdAt: new Date().toISOString() }
      state[kind].push(item)
      audit('created', kind)
      save()
      return item
    },
    update(kind, id, value) {
      if (!['tasks', 'events', 'notes', 'messages', 'automations'].includes(kind)) throw new Error('Unknown collection')
      const index = state[kind].findIndex(item => item.id === id)
      if (index < 0) throw new Error('Item not found')
      state[kind][index] = { ...state[kind][index], ...validateItem(kind, { ...state[kind][index], ...value }) }
      audit('updated', kind)
      save()
      return state[kind][index]
    },
    remove(kind, id) {
      if (!['tasks', 'events', 'notes', 'messages', 'automations'].includes(kind)) throw new Error('Unknown collection')
      const index = state[kind].findIndex(item => item.id === id)
      if (index < 0) throw new Error('Item not found')
      state[kind].splice(index, 1)
      audit('deleted', kind)
      save()
    },
    recordChat(prompt, answer) {
      state.conversations.push({ id: randomUUID(), prompt, answer, at: new Date().toISOString() })
      state.conversations = state.conversations.slice(-100)
      audit('generated', 'conversation')
      save()
    },
    restore(value) { state = value; audit('restored', 'workspace'); save() },
  }
}
