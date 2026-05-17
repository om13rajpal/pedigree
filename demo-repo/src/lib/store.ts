/** In-memory TODO store used by route handlers. */

import { randomUUID } from 'node:crypto'

/** A single TODO item. */
export interface Todo {
  id: string
  title: string
  completed: boolean
  createdAt: string
}

/** Internal storage -- keyed by todo ID. */
const todos = new Map<string, Todo>()

/** Return all todos as an array, ordered by creation time. */
export function getAllTodos(): Todo[] {
  return Array.from(todos.values())
}

/**
 * Create a new todo with the given title.
 *
 * @param title - Human-readable title for the todo.
 * @returns The newly created todo.
 */
export function createTodo(title: string): Todo {
  const todo: Todo = {
    id: randomUUID(),
    title,
    completed: false,
    createdAt: new Date().toISOString(),
  }
  todos.set(todo.id, todo)
  return todo
}

/**
 * Retrieve a single todo by ID.
 *
 * @param id - The UUID of the todo.
 * @returns The todo if found, otherwise undefined.
 */
export function getTodo(id: string): Todo | undefined {
  return todos.get(id)
}

/**
 * Delete a todo by ID. No-op if the ID does not exist.
 *
 * @param id - The UUID of the todo to remove.
 */
export function deleteTodo(id: string): void {
  todos.delete(id)
}

/**
 * Clear all todos. Useful for test isolation.
 */
export function clearTodos(): void {
  todos.clear()
}
