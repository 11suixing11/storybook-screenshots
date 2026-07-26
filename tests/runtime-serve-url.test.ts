import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { get } from "node:http"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createServer as createTcpServer } from "node:net"
import test from "node:test"
import { startStaticServer } from "../src/runtime/serve.js"

async function getFreePort(): Promise<number> {
  const server = createTcpServer()
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject)
    server.listen(0, "127.0.0.1", resolve)
  })
  const address = server.address()
  assert(address && typeof address === "object")
  const port = address.port
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
  return port
}

function request(url: string): Promise<{
  body: string
  statusCode: number | undefined
}> {
  return new Promise((resolve, reject) => {
    const req = get(url, { headers: { connection: "close" } }, (res) => {
      let body = ""
      res.setEncoding("utf8")
      res.on("data", (chunk) => {
        body += chunk
      })
      res.on("end", () => {
        resolve({ body, statusCode: res.statusCode })
      })
    })
    req.setTimeout(1000, () => {
      req.destroy(new Error(`Request timed out: ${url}`))
    })
    req.on("error", reject)
  })
}

test("returns 400 for malformed URL escapes and keeps serving", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "storybook-screenshots-serve-"))
  const server = await startStaticServer(rootDir, await getFreePort())
  try {
    await writeFile(join(rootDir, "index.html"), "ok")

    const badResponse = await request(`${server.url}/%`)
    assert.equal(badResponse.statusCode, 400)

    const okResponse = await request(`${server.url}/`)
    assert.equal(okResponse.statusCode, 200)
    assert.equal(okResponse.body, "ok")
  } finally {
    await server.close()
    await rm(rootDir, { force: true, recursive: true })
  }
})
