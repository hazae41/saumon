import { chars } from "@/libs/chars/mod.ts";
import { getAllRegexes } from "@/libs/regex/mod.ts";
import { replace } from "@/libs/replace/mod.ts";
import { Cursor } from "../../libs/cursor/mod.ts";

function readNextCall(text: string, index: number, regexes: Array<[number, number]>) {
  let call = ""
  let depth = 0

  const cursor = new Cursor(text)

  for (const type of chars(cursor, regexes)) {
    if (cursor.offset < index)
      continue
    if (cursor.offset === index && type !== "code")
      return

    if (type !== "code") {
      call += cursor.text[cursor.offset]
      continue
    }

    call += cursor.text[cursor.offset]

    if (cursor.text[cursor.offset] === "(") {
      depth++
      continue
    }

    if (cursor.text[cursor.offset] === ")") {
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

      const call = readNextCall(text, match.index, regexes)

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