import { createServer } from "node:http"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import assert from "node:assert/strict"
import test from "node:test"
import { startStaticServer } from "../src/runtime/serve.js"

function listen(server: ReturnType<typeof createServer>, port = 0): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once("error", reject)
    server.listen(port, "127.0.0.1", () => {
      server.off("error", reject)
      const address = server.address()
      if (!address || typeof address === "string") {
        reject(new Error("Expected TCP server address"))
        return
      }
      resolve(address.port)
    })
  })
}

function close(server: ReturnType<typeof createServer>): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error)
      else resolve()
    })
  })
}

test("retries the next port when the requested port is busy", async () => {
  const rootDir = mkdtempSync(join(tmpdir(), "storybook-screenshots-serve-"))
  writeFileSync(join(rootDir, "index.html"), "ok")
  const blocker = createServer((_req, res) => res.end("busy"))
  const occupiedPort = await listen(blocker)
  let server: Awaited<ReturnType<typeof startStaticServer>> | undefined

  try {
    server = await startStaticServer(rootDir, occupiedPort)

    assert.notEqual(server.url, `http://127.0.0.1:${occupiedPort}`)
    assert.match(server.url, /^http:\/\/127\.0\.0\.1:\d+$/)
    assert.equal(await fetch(server.url).then((res) => res.text()), "ok")
  } finally {
    await server?.close()
    await close(blocker)
    rmSync(rootDir, { recursive: true, force: true })
  }
})
