/** Pedigree error hierarchy -- all thrown errors extend PedigreeError. */

export class PedigreeError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PedigreeError'
  }
}

export class SchemaValidationError extends PedigreeError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SchemaValidationError'
  }
}

export class SigningError extends PedigreeError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'SigningError'
  }
}

export class VerificationError extends PedigreeError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'VerificationError'
  }
}

export class RekorError extends PedigreeError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'RekorError'
  }
}

export class PolicyViolationError extends PedigreeError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PolicyViolationError'
  }
}
