import ts from "@rollup/plugin-typescript";
import fs from "fs";
import path from "path";
import { rollup } from "rollup";

export namespace Strings {
  export function replaceAt(text: string, search: string, replace: string, start: number, end: number) {
    return text.slice(0, start) + text.slice(start, end).replace(search, replace) + text.slice(end)
  }
}

export async function compile(arg: string) {
  const extension = path.extname(arg).slice(1)

  if (!extension)
    throw new Error(`Not a macro file`)

  if (!arg.endsWith(`.macro.${extension}`))
    throw new Error(`Not a macro file`)

  const basename = path.basename(arg, `.macro.${extension}`)
  const filename = path.join(process.cwd(), arg)
  const dirname = path.dirname(filename)

  let text = fs.readFileSync(filename, "utf8")

  const imports = new Array<string>()
  const outputByInput = new Map<string, string>()
  const definitionByName = new Map<string, string>()

  // const lines = input.split("\n")

  interface Slot {
    x: number
  }

  // /**
  //  * Yield each char in a lines array
  //  * @param lines 
  //  * @param i line
  //  * @param j char
  //  */
  // function* allChars0(lines: string[], i: Slot, j: Slot) {
  //   /**
  //    * Continue on the current line
  //    */
  //   for (; j.x < lines[i.x].length; j.x++)
  //     yield lines[i.x][j.x]

  //   /**
  //    * Go to next line
  //    */
  //   i.x++

  //   /**
  //    * Continue for all next lines
  //    */
  //   for (; i.x < lines.length; i.x++) {
  //     if (lines[i.x] == null)
  //       continue

  //     /**
  //      * Newline
  //      */
  //     yield "\n"

  //     for (j.x = 0; j.x < lines[i.x].length; j.x++)
  //       yield lines[i.x][j.x]
  //   }
  // }

  // function isQuoted0(lines: string[], i: Slot, j: Slot, quote: string) {
  //   return lines[i.x][j.x] === quote && lines[i.x][j.x - 1] !== "\\"
  // }

  // /**
  //  * Yield all quoted chars if the current char is quoted
  //  * @param lines 
  //  * @param i 
  //  * @param j 
  //  * @param quote 
  //  * @returns 
  //  */
  // function* allQuotedChars0(lines: string[], i: Slot, j: Slot, quote: string) {
  //   if (!isQuoted0(lines, i, j, quote))
  //     return

  //   yield lines[i.x][j.x]
  //   j.x++

  //   /**
  //    * Yield until end
  //    */
  //   for (const char of allChars0(lines, i, j)) {
  //     if (lines[i.x][j.x] === quote && lines[i.x][j.x - 1] !== "\\") {
  //       yield lines[i.x][j.x]
  //       j.x++
  //       break
  //     }

  //     yield char
  //   }
  // }

  // function* allAnyQuotedChars0(lines: string[], i: Slot, j: Slot) {
  //   for (const quoted of allQuotedChars0(lines, i, j, "`"))
  //     yield quoted
  //   for (const quoted of allQuotedChars0(lines, i, j, "'"))
  //     yield quoted
  //   for (const quoted of allQuotedChars0(lines, i, j, '"'))
  //     yield quoted
  // }

  // function* allCharsWithQuote0(lines: string[], i: Slot, j: Slot) {
  //   for (const char of allChars0(lines, i, j)) {
  //     const quoteds = allAnyQuotedChars0(lines, i, j)

  //     let next = quoteds.next()

  //     if (next.done) {
  //       yield [char, false] as const
  //       continue
  //     }

  //     for (; !next.done; next = quoteds.next())
  //       yield [next.value, true] as const

  //     /**
  //      * Go back
  //      */
  //     j.x--

  //     continue
  //   }
  // }

  function isQuoted(text: string, i: Slot, quote: string) {
    return text[i.x] === quote && text[i.x - 1] !== "\\"
  }

  function* allDoubleQuoted(text: string, i: Slot) {
    while (isQuoted(text, i, '"')) {
      yield text[i.x]
      i.x++

      /**
       * Yield until end
       */
      for (; i.x < text.length; i.x++) {
        if (isQuoted(text, i, '"')) {
          yield text[i.x]
          i.x++
          break
        }

        yield text[i.x]
      }
    }
  }

  function* allSingleQuoted(text: string, i: Slot) {
    while (isQuoted(text, i, "'")) {
      yield text[i.x]
      i.x++

      /**
       * Yield until end
       */
      for (; i.x < text.length; i.x++) {
        if (isQuoted(text, i, "'")) {
          yield text[i.x]
          i.x++
          break
        }

        yield text[i.x]
      }
    }
  }

  function* allTemplateQuoted(text: string, i: Slot) {
    while (isQuoted(text, i, "`")) {
      yield text[i.x]
      i.x++

      /**
       * Yield until end
       */
      for (; i.x < text.length; i.x++) {
        if (isQuoted(text, i, "`")) {
          yield text[i.x]
          i.x++
          break
        }

        yield text[i.x]
      }
    }
  }

  function* allAnyQuoted(text: string, i: Slot) {
    if (isQuoted(text, i, "`"))
      yield* allTemplateQuoted(text, i)
    else if (isQuoted(text, i, "'"))
      yield* allSingleQuoted(text, i)
    else if (isQuoted(text, i, '"'))
      yield* allDoubleQuoted(text, i)
  }

  function* allUnquoted(text: string, i: Slot) {
    for (; i.x < text.length; i.x++) {
      /**
       * Skip until not in a quote
       */
      for (const _ of allAnyQuoted(text, i))
        continue

      /**
       * This char is not in a quote
       */
      yield text[i.x]

      /**
       * Check next char
       */
      continue
    }
  }

  function* allLine(text: string, i: Slot) {
    for (; i.x < text.length; i.x++) {
      /**
       * Do not check quoted
       */
      for (const _ of allAnyQuoted(text, i))
        yield text[i.x]

      /**
       * Stop at end of line
       */
      if (text[i.x] === "\n")
        break

      yield text[i.x]
    }
  }

  function* allExpression(text: string, i: Slot) {
    for (; i.x < text.length; i.x++) {
      /**
       * Do not check quoted
       */
      for (const _ of allAnyQuoted(text, i))
        yield text[i.x]

      /**
       * Stop at end of line
       */
      if (text[i.x] === "\n")
        break

      /**
       * Stop at the end of expression
       */
      if (text[i.x] === ";")
        break

      yield text[i.x]
    }
  }

  function readCall(text: string, i: Slot) {
    let call = ""
    let depth = 0

    for (; i.x < text.length; i.x++) {
      /**
       * Do not check quoted
       */
      for (const _ of allAnyQuoted(text, i))
        call += text[i.x]

      call += text[i.x]

      if (text[i.x] === "(") {
        depth++
        continue
      }

      if (text[i.x] === ")") {
        depth--

        if (depth === 0)
          break
        continue
      }

      continue
    }

    if (depth !== 0)
      throw new Error(`Unfinished call`)

    return call
  }

  function readBlock(text: string, i: Slot) {
    let call = ""
    let depth = 0

    for (; i.x < text.length; i.x++) {
      /**
       * Do not check quoted
       */
      for (const _ of allAnyQuoted(text, i))
        call += text[i.x]

      call += text[i.x]

      if (text[i.x] === "{") {
        depth++
        continue
      }

      if (text[i.x] === "}") {
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

  /**
   * Process expressions
   */
  for (const i = { x: 0 }; i.x < text.length; i.x++) {
    /**
     * Not at the start of an expression
     */
    if (i.x !== 0 && text[i.x - 1] !== "\n" && text[i.x - 1] !== ";")
      continue

    let expression = ""

    for (const char of allExpression(text, i))
      expression += char

    if (expression.trim().startsWith("import ")) {
      imports.push(expression)
      continue
    }

    continue
  }

  /**
   * Process lines
   */
  for (const i = { x: 0 }; i.x < text.length; i.x++) {
    /**
     * Not at the start of a line
     */
    if (i.x !== 0 && text[i.x - 1] !== "\n")
      continue

    let line = ""

    for (const char of allLine(text, i))
      line += char

    if (line.trim().startsWith("* @macro")) {
      const start = text.lastIndexOf("/**", i.x)
      const preend = text.indexOf("*/", i.x)
      const end = text.indexOf("\n", preend)

      const original = text.slice(start, end)

      const lines = original.split("\n")

      let line = 0

      delete lines[line++]
      delete lines[line++]

      for (; line < lines.length; line++)
        lines[line] = lines[line].trim().replace("* ", "")

      delete lines[line - 1];

      const modified = lines.filter(it => it != null).join("\n")

      text = Strings.replaceAt(text, original, modified, start, end)
      i.x = start + modified.length

      continue
    }

    continue
  }

  while (true) {
    /**
     * Rematch all in case the previous macro call returned another macro call
     * e.g. $macro1()$ returns "$macro2()"
     */
    const matches = [...text.matchAll(/(function )?([a-zA-Z0-9.]*\.)?(\$.+\$)(<.+>)?\(/g)]

    if (matches.length === 0)
      break

    /**
     * Reverse the matches so we patch macro calls in macro calls
     * e.g. $macro1$($macro2$()) will first patch $macro2$() then $macro1$()
     */
    matches.reverse()

    let stop = true

    for (const match of matches) {
      if (match.index == null)
        continue

      const [_raw, func, _prefix, name, _generic] = match

      /**
       * Check if definition
       */
      if (func) {
        if (definitionByName.has(name))
          continue

        const newline = text.lastIndexOf("\n", match.index)
        const semicolon = text.lastIndexOf(";", match.index)
        const start = Math.max(newline, semicolon) + 1

        const block = readBlock(text, { x: start })
        definitionByName.set(name, block)

        continue
      }

      const call = readCall(text, { x: match.index })

      /**
       * Check if cached
       */
      const cached = outputByInput.get(call)

      if (cached != null) {
        text = Strings.replaceAt(text, call, cached, match.index, match.index + cached.length)
        stop = false
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
          + `export const output = ${call}`

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
        outputByInput.set(call, awaited)

        /**
         * Apply
         */
        text = Strings.replaceAt(text, call, awaited, match.index, match.index + awaited.length)
        stop = false

        /**
         * Clean
         */
        // fs.rmSync(`${dirname}/.${identifier}.saumon.${extension}`)
        // fs.rmSync(`${dirname}/.${identifier}.saumon`, { recursive: true, force: true })
      }
    }

    if (stop)
      break
    continue
  }

  // /**
  //  * Apply macros
  //  */
  // {
  //   for (const i = { x: 0 }; i.x < lines.length; i.x++) {
  //     if (lines[i.x] == null)
  //       continue

  //     const matches = lines[i.x].matchAll(/([a-zA-Z0-9.]*\.)?(\$.+\$)(<.+>)?\(/g)

  //     for (const match of matches) {
  //       const i0 = i.x
  //       const name = match[2]

  //       for (const j = { x: 0 }; j.x < lines[i.x].length; j.x++) {
  //         /**
  //          * Skip to next char until we're not in a quote
  //          */
  //         for (const _ of allAnyQuotedChars0(lines, i, j))
  //           continue

  //         /**
  //          * Stop if we're no longer on the line of the match
  //          */
  //         if (i.x !== i0)
  //           break

  //         /**
  //          * Skip to next char if this is not the match
  //          */
  //         if (j.x !== match.index)
  //           continue
  //         const j0 = j.x

  //         /**
  //          * This is the match
  //          */
  //         let input = ""

  //         /**
  //          * Fill the input with the current char
  //          */
  //         input += lines[i.x][j.x]

  //         /**
  //          * Go to the next char
  //          */
  //         j.x++

  //         /**
  //          * Initial parenthesis depth
  //          */
  //         let depth = 0

  //         /**
  //          * Fill the input until a final closing parenthesis is found
  //          */
  //         for (const [char, quoted] of allCharsWithQuote0(lines, i, j)) {
  //           input += char

  //           if (quoted)
  //             continue

  //           if (char === "(") {
  //             depth++
  //             continue
  //           }

  //           if (char === ")") {
  //             depth--

  //             if (depth === 0)
  //               break
  //             continue
  //           }

  //           continue
  //         }

  //         const i1 = i.x
  //         const j1 = j.x

  //         console.log(input)

  //         // /**
  //         //  * It's a macro definition
  //         //  */
  //         // if (input.includes(`function ${name}`)) {
  //         //   let templated = false

  //         //   for (const j = { x: i.x }; j.x < lines.length; j.x++) {
  //         //     if (lines[j.x] == null)
  //         //       continue

  //         //     for (let k = 0; k < lines[j.x].length; k++) {
  //         //       if (lines[j.x][k] === "`" && lines[j.x][k - 1] !== "\\")
  //         //         templated = !templated
  //         //       continue
  //         //     }

  //         //     if (templated)
  //         //       continue

  //         //     if (lines[j.x] === "}") {
  //         //       /**
  //         //        * Save the definition
  //         //        */
  //         //       const definition = lines.slice(i.x, j.x + 1).join("\n")
  //         //       definitionByName.set(name, definition)
  //         //       break
  //         //     }

  //         //     continue
  //         //   }

  //         //   continue
  //         // }

  //         /**
  //          * Check if cached
  //          */
  //         const cached = outputByInput.get(input)

  //         if (cached != null) {
  //           lines[i0] = lines[i0].replaceAll(input, cached)
  //           break
  //         }

  //         /**
  //          * Per-call identifier
  //          */
  //         const identifier = crypto.randomUUID().split("-")[0]

  //         const definition = definitionByName.get(name) ?? ""

  //         /**
  //          * Check if CommonJS
  //          */
  //         if (typeof require !== "undefined") {
  //           throw new Error(`CommonJS not supported yet`)
  //         } else {
  //           const code = ``
  //             + imports.join("\n")
  //             + "\n\n"
  //             + definition
  //             + "\n\n"
  //             + `export const output = ${input}`

  //           fs.writeFileSync(`${dirname}/.${identifier}.saumon.${extension}`, code, "utf8")

  //           const [chunk] = await rollup({
  //             input: `${dirname}/.${identifier}.saumon.${extension}`,
  //             plugins: [(ts as any)()],
  //             external: ["tslib"]
  //           }).then(x => x.write({
  //             dir: `${dirname}/.${identifier}.saumon/`,
  //           })).then(x => x.output)

  //           const entry = path.join(`${dirname}/.${identifier}.saumon/`, chunk.fileName)

  //           const { output } = await import(entry)

  //           let awaited = await Promise.resolve(output)

  //           if (typeof awaited === "undefined")
  //             awaited = ""

  //           if (typeof awaited !== "string")
  //             throw new Error(`Evaluation failed`)

  //           /**
  //            * Fill the cache
  //            */
  //           outputByInput.set(input, awaited)

  //           /**
  //            * Apply
  //            */

  //           lines[i0] = lines[i0].slice(0, j0) + awaited

  //           for (let i = i0 + 1; i < i1; i++)
  //             delete lines[i]

  //           lines[i1] = lines[i1].slice(j1 + 1)

  //           /**
  //            * Clean
  //            */
  //           // fs.rmSync(`${dirname}/.${identifier}.saumon.${extension}`)
  //           // fs.rmSync(`${dirname}/.${identifier}.saumon`, { recursive: true, force: true })
  //         }

  //         break
  //       }

  //       continue
  //     }

  //     continue
  //   }
  // }

  // /**
  //  * Strip definitions
  //  */
  // {
  //   let templated = false

  //   for (let i = 0; i < lines.length; i++) {
  //     if (lines[i] == null)
  //       continue

  //     for (let k = 0; k < lines[i].length; k++) {
  //       if (lines[i][k] === "`" && lines[i][k - 1] !== "\\")
  //         templated = !templated
  //       continue
  //     }

  //     const match = lines[i].match(/function (\$.+\$)(<.+>)?\([^\)]*\)/)

  //     if (match == null)
  //       continue
  //     if (lines[i].startsWith("export"))
  //       continue

  //     /**
  //      * Strip definition
  //      */
  //     {
  //       let templated = false

  //       for (let j = i; j < lines.length; j++) {
  //         if (lines[j] == null)
  //           continue

  //         for (let k = 0; k < lines[j].length; k++) {
  //           if (lines[j][k] === "`" && lines[j][k - 1] !== "\\")
  //             templated = !templated
  //           continue
  //         }

  //         if (templated) {
  //           delete lines[j]
  //           continue
  //         }

  //         if (lines[j] === "}") {
  //           delete lines[j]

  //           if (lines[j + 1] === "")
  //             delete lines[j + 1]

  //           break
  //         }

  //         delete lines[j]
  //         continue
  //       }
  //     }

  //     continue
  //   }
  // }

  fs.writeFileSync(`${dirname}/${basename}.${extension}`, text, "utf8")
}