/**
 * Deep clone utility function
 * Creates a deep copy of an object, array, or primitive value
 */
export function deepClone<T>(value: T): T {
  // Handle null and undefined
  if (value === null || value === undefined) {
    return value
  }

  // Handle primitive types
  if (typeof value !== 'object') {
    return value
  }

  // Handle Date
  if (value instanceof Date) {
    return new Date(value.getTime()) as T
  }

  // Handle Array
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as T
  }

  // Handle Object
  const clonedObj = {} as T
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      clonedObj[key] = deepClone(value[key])
    }
  }

  return clonedObj
}

// Made with Bob
