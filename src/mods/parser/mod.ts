import { all, allTyped, getRegexes } from "@/libs/char/mod.ts";
import { Strings } from "@/libs/strings/mod.ts";

function readNextCall(text: string, regexes: Array<[number, number]>, start: number) {
  let call = ""
  let depth = 0

  const index = { value: 0 }
  const iterable = all(text, index)

  for (const type of allTyped(text, regexes, index, iterable)) {
    if (index.value < start)
      continue
    if (index.value === start && type !== "code")
      return
    /**
     * Do not check quoted
     */
    if (type !== "code") {
      call += text[index.value]
      continue
    }

    call += text[index.value]

    if (text[index.value] === "(") {
      depth++
      continue
    }

    if (text[index.value] === ")") {
      depth--
      if (depth === 0)
        break
      continue
    }

    continue
  }

  if (depth !== 0)
    throw new Error(`Unfinished call ${call}`)

  return call
}

export async function* parse(text: string): AsyncGenerator<string, string, string> {
  while (true) {
    const regexes = getRegexes(text)

    /**
     * Rematch all in case the previous macro call returned another macro call
     * e.g. $$(() => ...) returns "$$(() => ...)"
     */
    const matches = [...text.matchAll(/(declare function )?\$\$(<.+>)?\(/g)]

    if (matches.length === 0)
      break

    let restart = false

    /**
     * Reverse the matches so we can call macros in macro calls
     * e.g. $$(() => $$(() => ...)) will first call the inner macro
     */
    matches.reverse()

    for (const match of matches) {
      if (match.index == null)
        continue

      const declaration = match[1]

      if (declaration)
        continue

      const call = readNextCall(text, regexes, match.index)

      /**
       * Call is probably in a quote or in a comment
       */
      if (call == null)
        continue

      const output = yield call

      /**
       * Apply
       */
      text = Strings.replaceAt(text, call, output, match.index, match.index + call.length)

      /**
       * Restart because the content and indexes changed
       */
      restart = true

      break
    }

    if (restart)
      continue
    break
  }

  return text
}