import { appFetch, type CloudUpload, type ConsoleFetch } from '@/app/integrations/console'

/**
 * Moving sealed bytes to and from the bucket on the presigned links Console hands out. The bytes
 * never pass through Console, which is what lets a large file clear a serverless request limit.
 */
let override: ConsoleFetch | null = null

function blobFetch(): ConsoleFetch {
  return override ?? appFetch()
}

/** For tests: answer storage links from a stand-in. */
export function setCloudBlobFetchForTests(next: ConsoleFetch | null): void {
  override = next
}

export class CloudTransferError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null
  ) {
    super(message)
    this.name = 'CloudTransferError'
  }
}

export async function uploadBlob(
  upload: CloudUpload['upload'],
  bytes: Uint8Array<ArrayBuffer>
): Promise<void> {
  let response: Response
  try {
    response = await blobFetch()(upload.url, {
      method: upload.method,
      headers: upload.headers,
      body: new Blob([bytes]),
      credentials: 'omit'
    })
  } catch {
    throw new CloudTransferError('Redrob Cloud storage could not be reached')
  }
  if (!response.ok) {
    throw new CloudTransferError(
      `Redrob Cloud storage refused the upload (${response.status})`,
      response.status
    )
  }
}

export async function downloadBlob(
  url: string,
  maxBytes: number
): Promise<Uint8Array<ArrayBuffer>> {
  let response: Response
  try {
    response = await blobFetch()(url, { method: 'GET', credentials: 'omit' })
  } catch {
    throw new CloudTransferError('Redrob Cloud storage could not be reached')
  }
  if (!response.ok) {
    throw new CloudTransferError(
      `Redrob Cloud storage refused the download (${response.status})`,
      response.status
    )
  }
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new CloudTransferError('This file is larger than Redrob Design opens')
  }
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > maxBytes)
    throw new CloudTransferError('This file is larger than Redrob Design opens')
  return bytes
}
