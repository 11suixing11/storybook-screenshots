export function flagValue(
  argv: string[],
  ...names: string[]
): string | undefined {
  for (const [index, arg] of argv.entries()) {
    if (names.includes(arg)) {
      const value = argv[index + 1]
      if (value && !value.startsWith("-")) return value
      continue
    }

    for (const name of names) {
      const inlinePrefix = `${name}=`
      if (arg.startsWith(inlinePrefix)) {
        const value = arg.slice(inlinePrefix.length)
        if (value) return value
      }
    }
  }

  return undefined
}
