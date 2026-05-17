/**
 * Deep clone utility for creating independent copies of objects
 * @param obj - The object to clone
 * @returns A deep copy of the input object
 */
export function deepClone<T>(obj: T): T {
  // Handle null and undefined
  if (obj === null || obj === undefined) {
    return obj
  }

  // Handle primitive types
  if (typeof obj !== 'object') {
    return obj
  }

  // Handle Date
  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T
  }

  // Handle Array
  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as T
  }

  // Handle Object
  const clonedObj = {} as T
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      clonedObj[key] = deepClone(obj[key])
    }
  }

  return clonedObj
}

// Made with Bob
