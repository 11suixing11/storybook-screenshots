import assert from "node:assert/strict"
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { buildManifest, readFingerprints } from "../src/affected.js"
import { readJsonFile } from "../src/json.js"
import { RUNTIME_ENV_KEY, readRuntimeOptions } from "../src/runtime/options.js"

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "storybook-screenshots-json-"))
  try {
    return await fn(dir)
  } finally {
    await rm(dir, { force: true, recursive: true })
  }
}

function manifestOptions(rootDir: string) {
  return {
    rootDir,
    statsPath: join(rootDir, "preview-stats.json"),
    indexPath: join(rootDir, "index.json"),
    configPath: join(rootDir, "storybook-screenshots.config.mjs"),
    globalDeps: [],
  }
}

test("buildManifest reports a missing stats file with a usage hint", async () => {
  await withTempDir(async (rootDir) => {
    assert.throws(
      () => buildManifest(manifestOptions(rootDir)),
      (error) => {
        assert(error instanceof Error)
        assert.match(error.message, /Stats file not found at .+preview-stats\.json/)
        assert.match(error.message, /build Storybook with --stats-json/)
        return true
      }
    )
  })
})

test("buildManifest reports malformed stats JSON with its path and build hint", async () => {
  await withTempDir(async (rootDir) => {
    await writeFile(join(rootDir, "preview-stats.json"), "{")

    assert.throws(
      () => buildManifest(manifestOptions(rootDir)),
      (error) => {
        assert(error instanceof Error)
        assert.match(error.message, /Could not parse Stats file at .+preview-stats\.json/)
        assert.match(error.message, /Build Storybook with --stats-json/)
        return true
      }
    )
  })
})

test("buildManifest reports malformed Storybook index JSON with its path", async () => {
  await withTempDir(async (rootDir) => {
    await writeFile(join(rootDir, "preview-stats.json"), "{\"modules\":[]}")
    await writeFile(join(rootDir, "index.json"), "{")

    assert.throws(
      () => buildManifest(manifestOptions(rootDir)),
      (error) => {
        assert(error instanceof Error)
        assert.match(error.message, /Could not parse Storybook index at .+index\.json/)
        assert.match(error.message, /Build Storybook first/)
        return true
      }
    )
  })
})

test("readFingerprints keeps malformed stores on the full-recapture path", async () => {
  await withTempDir(async (rootDir) => {
    const fingerprintDir = join(rootDir, "fingerprints")
    await mkdir(fingerprintDir)
    await writeFile(join(fingerprintDir, "global.json"), "{")

    assert.equal(readFingerprints(fingerprintDir), null)
  })
})

test("readJsonFile reports malformed --only file JSON with its path", async () => {
  await withTempDir(async (rootDir) => {
    const onlyPath = join(rootDir, "only.json")
    await writeFile(onlyPath, "{")

    assert.throws(
      () =>
        readJsonFile(onlyPath, "--only file", {
          hint: "Expected JSON like { \"all\": false, \"storyIds\": [\"component--story\"] }.",
        }),
      (error) => {
        assert(error instanceof Error)
        assert.match(error.message, /Could not parse --only file at .+only\.json/)
        assert.match(error.message, /Expected JSON/)
        return true
      }
    )
  })
})

test("readRuntimeOptions reports malformed runtime options JSON", () => {
  const previous = process.env[RUNTIME_ENV_KEY]
  process.env[RUNTIME_ENV_KEY] = "{"
  try {
    assert.throws(
      () => readRuntimeOptions(),
      (error) => {
        assert(error instanceof Error)
        assert.match(error.message, /Could not parse STORYBOOK_SCREENSHOTS_OPTIONS runtime options/)
        assert.match(error.message, /storybook-screenshots CLI/)
        return true
      }
    )
  } finally {
    if (previous === undefined) {
      delete process.env[RUNTIME_ENV_KEY]
    } else {
      process.env[RUNTIME_ENV_KEY] = previous
    }
  }
})
