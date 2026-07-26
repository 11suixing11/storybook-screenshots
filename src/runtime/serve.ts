import { createReadStream, statSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join, normalize, sep } from "node:path"

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
}

export interface StaticServer {
  url: string
  close: () => Promise<void>
}

const MAX_PORT_ATTEMPTS = 20

/** Serve `rootDir` over HTTP on 127.0.0.1:`port`. Static files only, no SPA fallback. */
export function startStaticServer(
  rootDir: string,
  port: number
): Promise<StaticServer> {
  const server = createServer((req, res) => {
    const rawPath = decodeURIComponent((req.url ?? "/").split("?")[0] ?? "/")
    const relative = rawPath === "/" ? "index.html" : rawPath.replace(/^\/+/, "")
    // Resolve inside rootDir and reject path traversal.
    const filePath = normalize(join(rootDir, relative))
    if (filePath !== rootDir && !filePath.startsWith(rootDir + sep)) {
      res.statusCode = 403
      res.end("Forbidden")
      return
    }

    let target = filePath
    try {
      if (statSync(target).isDirectory()) {
        target = join(target, "index.html")
      }
    } catch {
      res.statusCode = 404
      res.end("Not found")
      return
    }

    let size: number
    try {
      size = statSync(target).size
    } catch {
      res.statusCode = 404
      res.end("Not found")
      return
    }

    res.statusCode = 200
    res.setHeader(
      "Content-Type",
      CONTENT_TYPES[extname(target).toLowerCase()] ?? "application/octet-stream"
    )
    res.setHeader("Content-Length", size)
    res.setHeader("Cache-Control", "no-store")
    createReadStream(target)
      .on("error", () => {
        res.statusCode = 500
        res.end("Read error")
      })
      .pipe(res)
  })

  return new Promise((resolvePromise, reject) => {
    let currentPort = port
    const lastPort = Math.min(port + MAX_PORT_ATTEMPTS - 1, 65_535)

    const listen = () => {
      const handleError = (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE" && currentPort < lastPort) {
          currentPort += 1
          listen()
          return
        }
        if (error.code === "EADDRINUSE") {
          reject(
            new Error(
              `Could not start the static server: ports ${port}-${currentPort} are already in use.`
            )
          )
          return
        }
        reject(error)
      }

      server.once("error", handleError)
      server.listen(currentPort, "127.0.0.1", () => {
        server.off("error", handleError)
        const address = server.address()
        if (!address || typeof address === "string") {
          server.close()
          reject(new Error("Could not determine the static server port."))
          return
        }
        resolvePromise({
          url: `http://127.0.0.1:${address.port}`,
          close: () =>
            new Promise((done) => {
              server.close(() => done())
            }),
        })
      })
    }

    if (lastPort < port) {
      reject(new Error(`Could not start the static server on invalid port ${port}.`))
      return
    }
    try {
      listen()
    } catch (error) {
      reject(error)
    }
  })
}
