import { readFileSync } from "node:fs"

interface JsonErrorOptions {
  hint?: string
  notFoundMessage?: string
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code)
    : undefined
}

function withHint(message: string, hint: string | undefined): string {
  return hint ? `${message} ${hint}` : message
}

export function parseJson<T>(
  json: string,
  label: string,
  options: JsonErrorOptions = {}
): T {
  try {
    return JSON.parse(json) as T
  } catch (error) {
    throw new Error(
      withHint(
        `Could not parse ${label}: ${errorMessage(error)}.`,
        options.hint
      ),
      { cause: error }
    )
  }
}

export function readJsonFile<T>(
  filePath: string,
  label: string,
  options: JsonErrorOptions = {}
): T {
  let json: string
  try {
    json = readFileSync(filePath, "utf8")
  } catch (error) {
    if (errorCode(error) === "ENOENT" && options.notFoundMessage) {
      throw new Error(options.notFoundMessage, { cause: error })
    }
    throw new Error(
      withHint(
        `Could not read ${label} at ${filePath}: ${errorMessage(error)}.`,
        options.hint
      ),
      { cause: error }
    )
  }
  return parseJson<T>(json, `${label} at ${filePath}`, options)
}
