import assert from "node:assert/strict"
import test from "node:test"
import { flagValue } from "../src/cli/args.js"

test("flagValue reads the following token for value flags", () => {
  assert.equal(
    flagValue(["--config", "storybook-screenshots.config.mjs"], "--config", "-c"),
    "storybook-screenshots.config.mjs"
  )
  assert.equal(flagValue(["--shard", "2/4"], "--shard"), "2/4")
})

test("flagValue supports equals syntax", () => {
  assert.equal(
    flagValue(["--config=storybook-screenshots.config.mjs"], "--config", "-c"),
    "storybook-screenshots.config.mjs"
  )
  assert.equal(
    flagValue(["-c=storybook-screenshots.config.mjs"], "--config", "-c"),
    "storybook-screenshots.config.mjs"
  )
  assert.equal(
    flagValue(["--only=button--primary,card--basic"], "--only"),
    "button--primary,card--basic"
  )
})

test("flagValue reads flags in argv order", () => {
  assert.equal(
    flagValue(
      ["--config", "first.config.mjs", "--config=second.config.mjs"],
      "--config",
      "-c"
    ),
    "first.config.mjs"
  )
})

test("flagValue does not consume another flag as a value", () => {
  assert.equal(flagValue(["--config", "--changed"], "--config", "-c"), undefined)
  assert.equal(flagValue(["--only", "--shard", "2/4"], "--only"), undefined)
})

test("flagValue continues after missing or empty occurrences", () => {
  assert.equal(
    flagValue(
      ["--config", "--changed", "--config=storybook.config.mjs"],
      "--config",
      "-c"
    ),
    "storybook.config.mjs"
  )
  assert.equal(flagValue(["--only=", "--only", "story--id"], "--only"), "story--id")
  assert.equal(flagValue(["--only="], "--only"), undefined)
})
