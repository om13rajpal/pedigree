/** Simple hello endpoint added to test the full Pedigree attestation pipeline. */

export function hello(name: string): string {
  return `Hello, ${name}! Your commit is cryptographically attested.`
}
