import { all, allTyped, type CharType, getRegexes, type Index } from "@/libs/char/mod.ts";
import { unclosed } from "@/libs/iterable/mod.ts";
import { Strings } from "@/libs/strings/mod.ts";
import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

function* allExpression(text: string, i: Index, c: Iterable<CharType>) {
  for (const type of unclosed(c)) {
    /**
     * Only check code
     */
    if (type !== "code") {
      yield
      continue
    }

    /**
     * Stop at end of line
     */
    if (text[i.value] === "\n")
      break

    /**
     * Stop at the end of expression
     */
    if (text[i.value] === ";")
      break

    yield
  }
}

function readCall(text: string, regexes: Array<[number, number]>, start: number) {
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

function readBlock(text: string, regexes: Array<[number, number]>, start: number) {
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

    if (text[index.value] === "{") {
      depth++
      continue
    }

    if (text[index.value] === "}") {
      depth--

      if (depth === 0)
        break
      continue
    }

    continue
  }

  if (depth !== 0)
    throw new Error(`Unfinished block`)

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

  const imports = new Set<string>()
  const outputByInput = new Map<string, string>()
  const definitionByName = new Map<string, string>()

  while (true) {
    const regexes = getRegexes(text)

    /**
     * Process expressions
     */
    {
      const index = { value: 0 }
      const voids = all(text, index)
      const chars = allTyped(text, regexes, index, voids)

      for (const _ of unclosed(chars)) {
        if (text[index.value] === "\n")
          continue
        if (text[index.value] === ";")
          continue

        let expression = text[index.value]

        for (const _ of allExpression(text, index, chars))
          expression += text[index.value]

        if (expression.trim().startsWith("import ")) {
          imports.add(expression)

          /**
           * Don't do further checks
           */
          continue
        }

        {
          let previous: number | undefined
          let current: number

          /**
           * Search all require() calls (even quoted or commented)
           */
          while ((current = expression.indexOf("require(", previous)) !== -1) {
            previous = current

            const index = { value: 0 }
            const voids = all(text, index)

            /**
             * Try to find it in unquoted and uncommented code
             */
            for (const type of allTyped(text, regexes, index, voids)) {
              if (type !== "code")
                continue

              if (index.value < current)
                continue
              if (index.value > current)
                break
              break
            }

            /**
             * Found it in unquoted and uncommented code
             */
            if (index.value === current) {
              imports.add(expression)

              /**
               * Stop searching
               */
              break
            }
          }

          /**
           * Go to next check
           */
        }

        continue
      }
    }

    /**
     * Process comments
     */
    {
      const index = { value: 0 }
      const voids = all(text, index)
      const chars = allTyped(text, regexes, index, voids)

      for (const type of unclosed(chars)) {
        if (type !== "block-commented")
          continue

        let comment = text[index.value]

        for (const type of unclosed(chars)) {
          if (type !== "block-commented")
            break
          comment += text[index.value]
        }

        const lines = comment.split("\n")

        if (lines.at(1)?.trim().startsWith("* @macro uncomment")) {
          const start = text.lastIndexOf("/*", index.value)
          const end = text.indexOf("*/", start) + 2

          const original = text.slice(start, end)

          let subindex = 0

          delete lines[subindex++]
          delete lines[subindex++]

          for (; subindex < lines.length; subindex++)
            lines[subindex] = lines[subindex].replace("* ", "")

          delete lines[subindex - 1]

          const modified = lines.filter(it => it != null).join("\n")

          text = Strings.replaceAt(text, original, modified, start, end)
          index.value = start + modified.length

          continue
        }

        if (lines.at(1)?.trim().startsWith("* @macro delete-next-lines")) {
          const start = text.lastIndexOf("/*", index.value)
          const preend = text.indexOf("\n\n", index.value + 1)

          const end = preend === -1
            ? text.length
            : preend + 2

          const original = text.slice(start, end)

          text = Strings.replaceAt(text, original, "", start, end)
          index.value = start

          continue
        }
      }
    }

    /**
     * Rematch all in case the previous macro call returned another macro call
     * e.g. $macro1()$ returns "$macro2()"
     */
    const matches = [...text.matchAll(/(export )?(declare )?(function )?([a-zA-Z0-9_]*\.)*(\$[a-zA-Z0-9_]+?\$)(<.+>)?\(/g)]

    if (matches.length === 0)
      break

    let restart = false

    /**
     * Process all definitions
     */
    for (const match of matches) {
      if (match.index == null)
        continue

      const [_raw, exp, decl, func, _prefix, name, _generic] = match

      /**
       * Ignore declarations
       */
      if (decl)
        continue

      /**
       * Ensure it's a macro definition
       */
      if (!func)
        continue

      if (definitionByName.has(name))
        continue

      const block = readBlock(text, regexes, match.index)

      /**
       * Block is probably in a quote or in a comment
       */
      if (block == null)
        continue

      definitionByName.set(name, block)

      /**
       * Do not erase exported macro functions
       */
      if (exp)
        continue

      let suffix = ""

      if (text[match.index + block.length] === "\n")
        suffix += "\n"

      if (text[match.index + block.length + 1] === "\n")
        suffix += "\n"

      text = Strings.replaceAt(text, block + suffix, "", match.index, match.index + block.length + suffix.length)

      /**
       * Restart because the content and indexes changed
       */
      restart = true

      break
    }

    if (restart)
      continue

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

      const [_raw, _exp, decl, func, _prefix, name, _generic] = match

      /**
       * Ignore declarations
       */
      if (decl)
        continue

      /**
       * Ensure it's a macro call
       */
      if (func)
        continue

      const call = readCall(text, regexes, match.index)

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

      const definition = definitionByName.get(name) ?? ""

      const code = ``
        + `function $raw$(text) { return text }`
        + "\n\n"
        + `function $run$(callback, options = {}) { const { space = 2 } = options; return (async () => JSON.stringify(await callback(), undefined, space))() }`
        + "\n\n"
        + [...imports.values()].join("\n")
        + "\n\n"
        + definition
        + "\n\n"
        + `export const output = ${call}`

      try {
        await fs.writeFile(`${dirname}/.${identifier}.saumon.${extension}`, code, "utf8")

        const { output } = await import(`${dirname}/.${identifier}.saumon.${extension}`)

        let awaited = await Promise.resolve(output)

        if (typeof awaited === "undefined")
          awaited = ""

        if (typeof awaited !== "string")
          throw new Error(`Evaluation failed`)

        /**
         * Fill the cache
         */
        outputByInput.set(call, awaited)

        /**
         * Apply
         */
        text = Strings.replaceAt(text, call, awaited, match.index, match.index + call.length)

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