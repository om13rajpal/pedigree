/** Integration tests for the /todos routes. */

import { describe, it, expect, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { registerTodoRoutes } from '../src/routes/todos.js'
import { clearTodos } from '../src/lib/store.js'

function buildApp() {
  const app = Fastify()
  registerTodoRoutes(app)
  return app
}

describe('/todos', () => {
  beforeEach(() => {
    clearTodos()
  })

  it('GET /todos returns empty array initially', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/todos' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual([])
  })

  it('POST /todos creates a todo and returns it', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/todos',
      payload: { title: 'Write attestation tests' },
    })

    expect(res.statusCode).toBe(201)
    const body = res.json()
    expect(body.title).toBe('Write attestation tests')
    expect(body.completed).toBe(false)
    expect(body.id).toBeDefined()
    expect(body.createdAt).toBeDefined()
  })

  it('DELETE /todos/:id removes the todo', async () => {
    const app = buildApp()
    const createRes = await app.inject({
      method: 'POST',
      url: '/todos',
      payload: { title: 'Temporary todo' },
    })
    const { id } = createRes.json()

    const deleteRes = await app.inject({ method: 'DELETE', url: `/todos/${id}` })
    expect(deleteRes.statusCode).toBe(204)

    const listRes = await app.inject({ method: 'GET', url: '/todos' })
    expect(listRes.json()).toEqual([])
  })

  it('DELETE /todos/:id returns 404 for unknown ID', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'DELETE',
      url: '/todos/nonexistent-id',
    })

    expect(res.statusCode).toBe(404)
    expect(res.json().error).toContain('not found')
  })
})
