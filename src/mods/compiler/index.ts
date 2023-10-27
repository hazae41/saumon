import fs from "fs/promises";
import { Index, all } from "libs/char/char.js";
import { Strings } from "libs/strings/strings.js";
import path from "path";

function* allLine(text: string, i: Index) {
  for (const { type, char } of all(text, i)) {
    /**
     * Only check code
     */
    if (type !== "code") {
      yield char
      continue
    }

    /**
     * Stop at end of line
     */
    if (char === "\n")
      break

    yield char
  }
}

function* allExpression(text: string, i: Index) {
  for (const { type, char } of all(text, i)) {
    /**
     * Only check code
     */
    if (type !== "code") {
      yield char
      continue
    }

    /**
     * Stop at end of line
     */
    if (char === "\n")
      break

    /**
     * Stop at the end of expression
     */
    if (char === ";")
      break

    yield char
  }
}

function readCall(text: string, index: number) {
  let call = ""
  let depth = 0

  const i = { x: 0 }

  for (const { type } of all(text, i)) {
    if (type !== "code")
      continue

    if (i.x < index)
      continue
    if (i.x > index)
      break
    break
  }

  if (i.x !== index)
    return

  for (const { type, char } of all(text, i)) {
    /**
     * Do not check quoted
     */
    if (type !== "code") {
      call += char
      continue
    }

    call += char

    if (char === "(") {
      depth++
      continue
    }

    if (char === ")") {
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

function readBlock(text: string, index: number) {
  let call = ""
  let depth = 0

  const i = { x: 0 }

  for (const { type } of all(text, i)) {
    if (type !== "code")
      continue

    if (i.x < index)
      continue
    if (i.x > index)
      break
    break
  }

  if (i.x !== index)
    return

  for (const { type, char } of all(text, i)) {
    /**
     * Do not check quoted
     */
    if (type !== "code") {
      call += char
      continue
    }

    call += char

    if (char === "{") {
      depth++
      continue
    }

    if (char === "}") {
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
    /**
     * Process expressions
     */
    {
      const i = { x: 0 }

      for (const { char } of all(text, i)) {
        if (char === "\n")
          continue
        if (char === ";")
          continue

        let expression = ""

        for (const char of allExpression(text, i))
          expression += char

        if (expression.trim().startsWith("import ")) {
          imports.add(expression)

          /**
           * Don't do further checks
           */
          continue
        }

        {
          let previous: number | undefined
          let index: number

          /**
           * Search all require() calls (even quoted or commented)
           */
          while ((index = expression.indexOf("require(", previous)) !== -1) {
            previous = index

            const i = { x: 0 }

            /**
             * Try to find it in unquoted and uncommented code
             */
            for (const { type } of all(text, i)) {
              if (type !== "code")
                continue

              if (i.x < index)
                continue
              if (i.x > index)
                break
              break
            }

            /**
             * Found it in unquoted and uncommented code
             */
            if (i.x === index) {
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
     * Process lines
     */
    {
      const i = { x: 0 }

      for (const { char } of all(text, i)) {
        if (char === "\n")
          continue

        let line = ""

        const start = i.x

        for (const char of allLine(text, i))
          line += char

        const end = i.x

        if (line.trim().startsWith("/*")) {
          const lines = line.split("\n")

          if (lines[1].trim().startsWith("* @macro")) {
            let index = 0

            delete lines[index++]
            delete lines[index++]

            for (; index < lines.length; index++)
              lines[index] = lines[index].replace("* ", "")

            delete lines[index - 1]

            const modified = lines.filter(it => it != null).join("\n")

            text = Strings.replaceAt(text, line, modified, start, end)
            i.x = start + modified.length

            continue
          }
        }

        continue
      }
    }

    /**
     * Rematch all in case the previous macro call returned another macro call
     * e.g. $macro1()$ returns "$macro2()"
     */
    const matches = [...text.matchAll(/(function )?([a-zA-Z0-9.]*\.)?(\$.+?\$)(<.+>)?\(/g)]

    if (matches.length === 0)
      break

    let restart = false

    /**
     * Process all definitions
     */
    for (const match of matches) {
      if (match.index == null)
        continue

      const [_raw, func, _prefix, name, _generic] = match

      /**
       * Ensure it's a macro definition
       */
      if (!func)
        continue

      if (definitionByName.has(name))
        continue

      const newline = text.lastIndexOf("\n", match.index)
      const semicolon = text.lastIndexOf(";", match.index)
      const start = Math.max(newline, semicolon) + 1

      const block = readBlock(text, start)

      /**
       * Block is probably in a quote or in a comment
       */
      if (block == null)
        continue

      definitionByName.set(name, block)

      if (block.trim().startsWith("export"))
        continue

      let suffix = ""

      if (text[start + block.length] === "\n")
        suffix += "\n"

      if (text[start + block.length + 1] === "\n")
        suffix += "\n"

      text = Strings.replaceAt(text, block + suffix, "", start, start + block.length + suffix.length)

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

      const [_raw, func, _prefix, name, _generic] = match

      /**
       * Ensure it's a macro call
       */
      if (func)
        continue

      const call = readCall(text, match.index)

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