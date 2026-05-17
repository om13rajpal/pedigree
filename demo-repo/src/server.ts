/** Fastify entrypoint for the Pedigree demo TODO API. */

import Fastify from 'fastify'
import { registerTodoRoutes } from './routes/todos.js'

const PORT = 3001

async function start(): Promise<void> {
  const server = Fastify({ logger: true })

  registerTodoRoutes(server)

  try {
    await server.listen({ port: PORT, host: '0.0.0.0' })
  } catch (err) {
    server.log.error(err)
    process.exit(1)
  }

  const shutdown = async (): Promise<void> => {
    server.log.info('Shutting down gracefully')
    await server.close()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

start()
