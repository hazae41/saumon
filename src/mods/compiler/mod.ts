import { all, allTyped, getRegexes } from "@/libs/char/mod.ts";
import { Strings } from "@/libs/strings/mod.ts";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

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

export interface CompileOptions {
  readonly debug?: boolean
}

export async function compile(file: string, options: CompileOptions = {}) {
  const { debug = false } = options

  const extension = path.extname(file).slice(1)

  console.log(file)

  if (!extension)
    throw new Error(`Not a macro file`)

  if (!file.endsWith(`.macro.${extension}`))
    throw new Error(`Not a macro file`)

  const basename = path.basename(file, `.macro.${extension}`)
  const filename = path.join(process.cwd(), file)
  const dirname = path.dirname(filename)

  let text = await fs.readFile(filename, "utf8")

  const outputByInput = new Map<string, string>()

  while (true) {
    const regexes = getRegexes(text)

    /**
     * Rematch all in case the previous macro call returned another macro call
     * e.g. $macro1()$ returns "$macro2()"
     */
    const matches = [...text.matchAll(/(declare function )?\$\$(<.+>)?\(/g)]

    if (matches.length === 0)
      break

    let restart = false

    /**
     * Reverse the matches so we can patch macro calls in macro calls
     * e.g. $macro1$($macro2$()) will first patch $macro2$() then $macro1$()
     */
    matches.reverse()

    /**
     * Process all macro calls
     */
    for (const match of matches) {
      if (match.index == null)
        continue

      const [_, declaration] = match

      /**
       * Ensure it's a macro call
       */
      if (declaration)
        continue

      const call = readNextCall(text, regexes, match.index)

      /**
       * Call is probably in a quote or in a comment
       */
      if (call == null)
        continue

      /**
       * Check if cached
       */
      const cached = outputByInput.get(call)

      if (cached != null) {
        text = Strings.replaceAt(text, call, cached, match.index, match.index + call.length)

        /**
         * Restart because the content and indexes changed
         */
        restart = true

        break
      }

      /**
       * Per-call identifier
       */
      const identifier = crypto.randomUUID().split("-")[0]

      const code = `const $$ = (callback) => callback(); export const run = await ${call}`

      try {
        await fs.writeFile(`${dirname}/.${identifier}.saumon.${extension}`, code, "utf8")

        let { output } = await import(`${dirname}/.${identifier}.saumon.${extension}`)

        if (output == null)
          output = ""

        if (typeof output !== "string")
          throw new Error(`Evaluation failed`)

        /**
         * Fill the cache
         */
        outputByInput.set(call, output)

        /**
         * Apply
         */
        text = Strings.replaceAt(text, call, output, match.index, match.index + call.length)

        /**
         * Restart because the content and indexes changed
         */
        restart = true

        break
      } finally {
        if (!debug) {
          /**
           * Clean
           */
          await fs.rm(`${dirname}/.${identifier}.saumon.${extension}`, { force: true })
        }
      }
    }

    if (restart)
      continue
    break
  }

  await fs.writeFile(`${dirname}/${basename}.${extension}`, text, "utf8")
}