/** Route definitions for the /todos resource. */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { getAllTodos, createTodo, deleteTodo, getTodo } from '../lib/store.js'

/** Shape of the POST /todos request body. */
interface CreateTodoBody {
  title: string
}

/** Shape of the DELETE /todos/:id route params. */
interface TodoIdParams {
  id: string
}

/**
 * Register all TODO CRUD routes on the given Fastify instance.
 *
 * Keeps route definitions thin: validation, delegation to the store,
 * and response formatting only.
 *
 * @param server - The Fastify instance to attach routes to.
 */
export function registerTodoRoutes(server: FastifyInstance): void {
  server.get('/todos', async (_request: FastifyRequest, reply: FastifyReply) => {
    const todos = getAllTodos()
    return reply.send(todos)
  })

  server.post(
    '/todos',
    {
      schema: {
        body: {
          type: 'object',
          required: ['title'],
          properties: {
            title: { type: 'string', minLength: 1 },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Body: CreateTodoBody }>, reply: FastifyReply) => {
      const { title } = request.body
      const todo = createTodo(title)
      return reply.status(201).send(todo)
    },
  )

  server.delete(
    '/todos/:id',
    async (request: FastifyRequest<{ Params: TodoIdParams }>, reply: FastifyReply) => {
      const { id } = request.params
      const existing = getTodo(id)

      if (!existing) {
        return reply.status(404).send({ error: `Todo ${id} not found` })
      }

      deleteTodo(id)
      return reply.status(204).send()
    },
  )
}
