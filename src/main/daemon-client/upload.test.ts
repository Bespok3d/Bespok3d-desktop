import { describe, it, expect } from 'vitest'
import type { ClientRequest } from 'http'
import { sliceChunks, streamUpload, UPLOAD_CHUNK_BYTES } from './upload'

describe('sliceChunks', () => {
  it('splits a buffer into ceil(length/chunk) pieces, the last one short', () => {
    expect(sliceChunks(Buffer.alloc(100), 40).map((chunk) => chunk.length)).toEqual([40, 40, 20])
  })

  it('returns no chunks for an empty buffer', () => {
    expect(sliceChunks(Buffer.alloc(0), 40)).toEqual([])
  })
})

function fakeRequest(writeFlushes: boolean) {
  const state = { written: 0, ended: false, drains: 0 }
  const req = {
    write: (chunk: Buffer) => { state.written += chunk.length;

 return writeFlushes },
    once: (_event: string, onDrain: () => void) => { state.drains += 1; onDrain() },
    end: () => { state.ended = true },
  }

  return { req: req as unknown as ClientRequest, state }
}

describe('streamUpload', () => {
  it('reports cumulative bytes after each chunk and ends the request', async () => {
    const body = Buffer.alloc(UPLOAD_CHUNK_BYTES + 10)
    const { req, state } = fakeRequest(true)
    const seen: Array<[number, number]> = []
    await streamUpload(req, body, (sent, total) => seen.push([sent, total]))
    expect(seen).toEqual([[UPLOAD_CHUNK_BYTES, body.length], [body.length, body.length]])
    expect(state.written).toBe(body.length)
    expect(state.ended).toBe(true)
  })

  it('waits for drain on every chunk when write signals backpressure', async () => {
    const body = Buffer.alloc(UPLOAD_CHUNK_BYTES * 2)
    const { req, state } = fakeRequest(false)
    await streamUpload(req, body, () => undefined)
    expect(state.drains).toBe(2)
    expect(state.ended).toBe(true)
  })
})
