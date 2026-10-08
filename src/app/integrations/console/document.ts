/**
 * The id Console knows a document by: a SHA-256 of the app's own key for
 * it, so a file's path on this computer never leaves it.
 */
export async function consoleDocumentId(documentKey: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(documentKey))
  const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0'))
  return `doc_${hex.join('')}`
}
