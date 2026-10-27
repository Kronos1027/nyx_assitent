import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { once } from 'node:events'

test('local HTTP workflow persists actual requests and blocks foreign origins', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'nyx-http-test-'))
  const origin = 'http://127.0.0.1:14319'
  let child
  async function launch() {
    child = spawn(process.execPath, ['server/index.js'], { cwd: process.cwd(), env: { ...process.env, NYX_PORT: '14319', NYX_DATA_DIR: directory }, stdio: ['ignore', 'pipe', 'pipe'] })
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Local service did not start')), 10000)
      child.once('error', error => { clearTimeout(timer); reject(error) })
      child.once('exit', () => { clearTimeout(timer); reject(new Error('Local service exited before startup')) })
      child.stdout.once('data', () => { clearTimeout(timer); resolve() })
    })
  }
  async function stop() {
    if (!child || child.exitCode !== null) return
    const exit = once(child, 'exit')
    child.kill()
    await exit
  }
  try {
    await launch()
    const response = await fetch(`${origin}/api/state`)
    const state = await response.json()
    assert.equal(state.tasks.length, 0)
    const rejected = await fetch(`${origin}/api/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'CSRF rejection test' }) })
    assert.equal(rejected.status, 403)
    const foreign = await fetch(`${origin}/api/state`, { headers: { Origin: 'https://untrusted.invalid' } })
    assert.equal(foreign.status, 403)
    const result = await fetch(`${origin}/api/tasks`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Nyx-CSRF': state.csrf }, body: JSON.stringify({ title: 'HTTP persistence assertion' }) })
    assert.equal(result.status, 201)
    const task = await result.json()
    await stop()
    await launch()
    const restarted = await (await fetch(`${origin}/api/state`)).json()
    assert.equal(restarted.tasks[0].id, task.id)
    assert.equal(restarted.tasks[0].title, 'HTTP persistence assertion')
    const invalid = await fetch(`${origin}/api/events`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Nyx-CSRF': restarted.csrf }, body: JSON.stringify({ title: 'Invalid date assertion', at: 'no-date' }) })
    assert.equal(invalid.status, 400)
    const html = await fetch(origin)
    assert.equal(html.status, 200)
    assert.match(html.headers.get('content-security-policy'), /frame-ancestors 'none'/)
  } finally { await stop(); rmSync(directory, { recursive: true }) }
})
