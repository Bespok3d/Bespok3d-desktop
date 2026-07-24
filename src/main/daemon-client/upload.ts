import type { ClientRequest } from 'http'

// Streams a request body to the daemon chunk by chunk so the upload reports real progress, instead of
// the whole multipart being written at once with no feedback (a multi-MB plugin otherwise looks frozen
// at "Sending to printer..."). This is purely the client-side write of the socket; the daemon does not
// see the request until the full body has arrived, so this stage is distinct from its phase feed.

// Large enough that per-chunk overhead is negligible, small enough that a multi-MB plugin reports
// progress smoothly rather than jumping straight to done.
export const UPLOAD_CHUNK_BYTES = 64 * 1024

export function sliceChunks(body: Buffer, chunkBytes: number): Buffer[] {
  const chunkCount = Math.ceil(body.length / chunkBytes)

  return Array.from({ length: chunkCount }, (_unused, chunkIndex) =>
    body.subarray(chunkIndex * chunkBytes, chunkIndex * chunkBytes + chunkBytes),
  )
}

// Resolves once the chunk has left our buffer, waiting for drain under backpressure so progress tracks
// the socket's real throughput rather than racing to 100% the moment the body is queued.
function writeChunk(req: ClientRequest, chunk: Buffer): Promise<void> {
  return new Promise((resolve) => {
    if (req.write(chunk)) resolve()
    else req.once('drain', resolve)
  })
}

// Chunks must reach the socket in order (they are one body), so this writes them head-then-tail by
// recursion, awaiting each one's drain before the next, rather than queueing them concurrently.
async function writeChunksInOrder(
  req: ClientRequest,
  chunks: readonly Buffer[],
  chunkIndex: number,
  totalBytes: number,
  onUploadProgress: (sentBytes: number, totalBytes: number) => void,
): Promise<void> {
  if (chunkIndex >= chunks.length) return

  await writeChunk(req, chunks[chunkIndex])
  onUploadProgress(Math.min((chunkIndex + 1) * UPLOAD_CHUNK_BYTES, totalBytes), totalBytes)

  return writeChunksInOrder(req, chunks, chunkIndex + 1, totalBytes, onUploadProgress)
}

export function streamUpload(req: ClientRequest, body: Buffer, onUploadProgress: (sentBytes: number, totalBytes: number) => void): Promise<void> {
  const chunks = sliceChunks(body, UPLOAD_CHUNK_BYTES)

  return writeChunksInOrder(req, chunks, 0, body.length, onUploadProgress).then(() => { req.end() })
}
