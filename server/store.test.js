import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStore, blankState, validateItem, encryptBackup, decryptBackup } from './store.js'

test('new workspaces contain no prepopulated user data', () => {
  assert.ok(Object.values(blankState()).every(items => items.length === 0))
})

test('saved records survive restart and audit never repeats content', () => {
  const directory = mkdtempSync(join(tmpdir(), 'nyx-store-test-'))
  try {
    const store = createStore(directory)
    const task = store.add('tasks', { title: 'Persistence test', done: false })
    store.update('tasks', task.id, { done: true })
    const restarted = createStore(directory)
    assert.equal(restarted.read().tasks[0].done, true)
    assert.equal(restarted.read().audit.length, 2)
    assert.equal(JSON.stringify(restarted.read().audit).includes('Persistence test'), false)
    restarted.remove('tasks', task.id)
    assert.equal(createStore(directory).read().tasks.length, 0)
  } finally { rmSync(directory, { recursive: true }) }
})

test('untrusted field names and invalid inputs cannot write arbitrary collections', () => {
  assert.throws(() => validateItem('audit', { title: 'Rejected' }))
  assert.throws(() => validateItem('tasks', { title: ' ', done: true }))
  assert.throws(() => validateItem('tasks', { title: 'Rejected', done: 'true' }))
  assert.throws(() => validateItem('events', { title: 'Rejected', at: 'not-a-date' }))
  assert.deepEqual(validateItem('notes', { title: 'Allowed', executable: 'discarded' }), { title: 'Allowed' })
})

test('encrypted backup round trip rejects wrong passwords and tampering', () => {
  const state = blankState()
  state.notes.push({ title: 'Backup test', body: 'Round trip assertion' })
  state.conversations.push({ prompt: 'Round trip prompt', answer: 'Round trip response', at: new Date().toISOString() })
  const password = 'temporary-test-password'
  const encrypted = encryptBackup(state, password)
  assert.equal(JSON.stringify(encrypted).includes('Round trip assertion'), false)
  assert.equal(decryptBackup(encrypted, password).notes[0].body, 'Round trip assertion')
  assert.equal(decryptBackup(encrypted, password).conversations[0].answer, 'Round trip response')
  assert.throws(() => decryptBackup(encrypted, 'a-wrong-test-password'))
  const changed = { ...encrypted, data: Buffer.from('changed-data').toString('base64') }
  assert.throws(() => decryptBackup(changed, password))
  assert.throws(() => encryptBackup(state, 'short'))
})
