import ts from "@rollup/plugin-typescript";
import fs from "fs";
import path from "path";
import { rollup } from "rollup";

export async function compile(arg: string) {
  const extension = path.extname(arg).slice(1)

  if (!extension)
    throw new Error(`Not a macro file`)

  if (!arg.endsWith(`.macro.${extension}`))
    throw new Error(`Not a macro file`)

  const basename = path.basename(arg, `.macro.${extension}`)
  const filename = path.join(process.cwd(), arg)
  const dirname = path.dirname(filename)

  const input = fs.readFileSync(filename, "utf8")

  const imports = new Array<string>()
  const outputByInput = new Map<string, string>()
  const definitionByName = new Map<string, string>()

  const lines = input.split("\n")

  interface Slot {
    x: number
  }

  /**
   * Yield each char in a lines array
   * @param lines 
   * @param i line
   * @param j char
   */
  function* allChars(lines: string[], i: Slot, j: Slot) {
    /**
     * Continue on the current line
     */
    for (; j.x < lines[i.x].length; j.x++)
      yield lines[i.x][j.x]

    /**
     * Newline
     */
    yield "\n"

    /**
     * Go to next line
     */
    i.x++

    /**
     * Continue for all next lines
     */
    for (; i.x < lines.length; i.x++) {
      if (lines[i.x] == null)
        continue
      for (j.x = 0; j.x < lines[i.x].length; j.x++)
        yield lines[i.x][j.x]
    }
  }

  function isQuoted(lines: string[], i: Slot, j: Slot, quote: string) {
    return lines[i.x][j.x] === quote && lines[i.x][j.x - 1] !== "\\"
  }

  /**
   * Yield all quoted chars if the current char is quoted
   * @param lines 
   * @param i 
   * @param j 
   * @param quote 
   * @returns 
   */
  function* allQuotedChars(lines: string[], i: Slot, j: Slot, quote: string) {
    if (!isQuoted(lines, i, j, quote))
      return

    yield lines[i.x][j.x]
    j.x++

    /**
     * Yield until end
     */
    for (const char of allChars(lines, i, j)) {
      if (lines[i.x][j.x] === quote && lines[i.x][j.x - 1] !== "\\") {
        yield lines[i.x][j.x]
        j.x++
        break
      }

      yield char
    }
  }

  function* allAnyQuotedChars(lines: string[], i: Slot, j: Slot) {
    for (const quoted of allQuotedChars(lines, i, j, "`"))
      yield quoted
    for (const quoted of allQuotedChars(lines, i, j, "'"))
      yield quoted
    for (const quoted of allQuotedChars(lines, i, j, '"'))
      yield quoted
  }

  function* allUnquotedChars(lines: string[], i: Slot, j: Slot) {
    for (const char of allChars(lines, i, j)) {
      const quoteds = allAnyQuotedChars(lines, i, j)

      let next = quoteds.next()

      if (next.done) {
        yield char
        continue
      }

      for (; !next.done; next = quoteds.next())
        continue
      continue
    }
  }

  function* allCharsWithQuote(lines: string[], i: Slot, j: Slot) {
    for (const char of allChars(lines, i, j)) {
      const quoteds = allAnyQuotedChars(lines, i, j)

      let next = quoteds.next()

      if (next.done) {
        yield [char, false] as const
        continue
      }

      for (; !next.done; next = quoteds.next())
        yield [next.value, true] as const
      continue
    }
  }

  /**
   * First preprocessing to detect imports and uncomment
   */
  {
    for (const i = { x: 0 }; i.x < lines.length; i.x++) {
      if (lines[i.x] == null)
        continue

      for (const j = { x: 0 }; j.x < lines[i.x].length; j.x++) {
        /**
         * Skip to next char until we're not in a quote
         */
        for (const _ of allAnyQuotedChars(lines, i, j))
          continue

        /**
         * Skip to next char if we're no longer at the start of the line
         */
        if (j.x !== 0)
          continue

        /**
         * Detect imports
         */
        if (lines[i.x].startsWith("import")) {
          imports.push(lines[i.x])
          break
        }

        /**
         * Detect block comment
         */
        if (lines[i.x].trim().startsWith("* @macro")) {
          /**
           * Assume previous line is "/**" and delete it
           */
          delete lines[i.x - 1]

          /**
           * Delete current line
           */
          delete lines[i.x]

          /**
           * Uncomment next lines until end
           */
          for (i.x++; i.x < lines.length; i.x++) {
            if (lines[i.x] == null)
              continue
            if (lines[i.x].trim().startsWith("*/"))
              break
            lines[i.x] = lines[i.x].replace("* ", "")
          }

          /**
           * Delete last line
           */
          delete lines[i.x]

          /**
           * Go to next char
           */
          break
        }
      }

      /**
       * Go to the next line
       */
      continue
    }
  }

  /**
   * Apply macros
   */
  {
    for (const i = { x: 0 }; i.x < lines.length; i.x++) {
      if (lines[i.x] == null)
        continue

      const matches = lines[i.x].matchAll(/([a-zA-Z0-9.]*\.)?(\$.+\$)(<.+>)?\(/)

      for (const match of matches) {
        const line = i.x
        const name = match[2]

        for (const j = { x: 0 }; j.x < lines[i.x].length; j.x++) {
          /**
           * Skip to next char until we're not in a quote
           */
          for (const _ of allAnyQuotedChars(lines, i, j))
            continue

          /**
           * Stop if we're no longer on the line of the match
           */
          if (i.x !== line)
            break

          /**
           * Skip to next char if this is not the match
           */
          if (j.x !== match.index)
            continue

          /**
           * This is the match
           */
          let input = ""

          /**
           * Fill the input with the current char
           */
          input += lines[i.x][j.x]

          /**
           * Go to the next char
           */
          j.x++

          /**
           * Initial parenthesis depth
           */
          let depth = 0

          /**
           * Fill the input until a final closing parenthesis is found
           */
          for (const [char, quoted] of allCharsWithQuote(lines, i, j)) {
            input += char

            if (quoted)
              continue

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

          // /**
          //  * It's a macro definition
          //  */
          // if (input.includes(`function ${name}`)) {
          //   let templated = false

          //   for (const j = { x: i.x }; j.x < lines.length; j.x++) {
          //     if (lines[j.x] == null)
          //       continue

          //     for (let k = 0; k < lines[j.x].length; k++) {
          //       if (lines[j.x][k] === "`" && lines[j.x][k - 1] !== "\\")
          //         templated = !templated
          //       continue
          //     }

          //     if (templated)
          //       continue

          //     if (lines[j.x] === "}") {
          //       /**
          //        * Save the definition
          //        */
          //       const definition = lines.slice(i.x, j.x + 1).join("\n")
          //       definitionByName.set(name, definition)
          //       break
          //     }

          //     continue
          //   }

          //   continue
          // }

          /**
           * Check if cached
           */
          const cached = outputByInput.get(input)

          if (cached != null) {
            lines[i.x] = lines[i.x].replaceAll(input, cached)
            break
          }

          /**
           * Per-call identifier
           */
          const identifier = crypto.randomUUID().split("-")[0]

          const definition = definitionByName.get(name) ?? ""

          /**
           * Check if CommonJS
           */
          if (typeof require !== "undefined") {
            throw new Error(`CommonJS not supported yet`)
          } else {
            const code = ``
              + imports.join("\n")
              + "\n\n"
              + definition
              + "\n\n"
              + `export const output = ${input}`

            fs.writeFileSync(`${dirname}/.${identifier}.saumon.${extension}`, code, "utf8")

            const [chunk] = await rollup({
              input: `${dirname}/.${identifier}.saumon.${extension}`,
              plugins: [(ts as any)()],
              external: ["tslib"]
            }).then(x => x.write({
              dir: `${dirname}/.${identifier}.saumon/`,
            })).then(x => x.output)

            const entry = path.join(`${dirname}/.${identifier}.saumon/`, chunk.fileName)

            const { output } = await import(entry)

            let awaited = await Promise.resolve(output)

            if (typeof awaited === "undefined")
              awaited = ""

            if (typeof awaited !== "string")
              throw new Error(`Evaluation failed`)

            /**
             * Fill the cache
             */
            outputByInput.set(input, awaited)

            /**
             * Apply
             */
            lines[i.x] = lines[i.x].replaceAll(input, awaited)

            /**
             * Clean
             */
            fs.rmSync(`${dirname}/.${identifier}.saumon.${extension}`)
            fs.rmSync(`${dirname}/.${identifier}.saumon`, { recursive: true, force: true })
          }

          break
        }

        continue
      }

      continue
    }
  }

  /**
   * Strip definitions
   */
  {
    let templated = false

    for (let i = 0; i < lines.length; i++) {
      if (lines[i] == null)
        continue

      for (let k = 0; k < lines[i].length; k++) {
        if (lines[i][k] === "`" && lines[i][k - 1] !== "\\")
          templated = !templated
        continue
      }

      const match = lines[i].match(/function (\$.+\$)(<.+>)?\([^\)]*\)/)

      if (match == null)
        continue
      if (lines[i].startsWith("export"))
        continue

      /**
       * Strip definition
       */
      {
        let templated = false

        for (let j = i; j < lines.length; j++) {
          if (lines[j] == null)
            continue

          for (let k = 0; k < lines[j].length; k++) {
            if (lines[j][k] === "`" && lines[j][k - 1] !== "\\")
              templated = !templated
            continue
          }

          if (templated) {
            delete lines[j]
            continue
          }

          if (lines[j] === "}") {
            delete lines[j]

            if (lines[j + 1] === "")
              delete lines[j + 1]

            break
          }

          delete lines[j]
          continue
        }
      }

      continue
    }
  }

  const output = lines.filter(it => it != null).join("\n")

  fs.writeFileSync(`${dirname}/${basename}.${extension}`, output, "utf8")
}