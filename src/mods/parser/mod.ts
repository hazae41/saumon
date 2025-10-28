import { all } from "@/libs/chars/mod.ts";
import { curse } from "@/libs/cursor/mod.ts";
import { getAllRegexes } from "@/libs/regex/mod.ts";
import { replace } from "@/libs/replace/mod.ts";

function readNextCall(text: string, regexes: Array<[number, number]>, start: number) {
  let call = ""
  let depth = 0

  const cursor = { value: 0 }
  const cursed = curse(text, cursor)

  for (const type of all(text, cursor, cursed, regexes)) {
    if (cursor.value < start)
      continue
    if (cursor.value === start && type !== "code")
      return

    if (type !== "code") {
      call += text[cursor.value]
      continue
    }

    call += text[cursor.value]

    if (text[cursor.value] === "(") {
      depth++
      continue
    }

    if (text[cursor.value] === ")") {
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
    const regexes = getAllRegexes(text)

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
      text = replace(text, call, output, match.index, match.index + call.length)

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