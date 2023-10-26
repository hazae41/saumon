import fs from "fs/promises";
import path from "path";
import ts from "typescript";

export namespace Strings {
  export function replaceAt(text: string, search: string, replace: string, start: number, end: number) {
    return text.slice(0, start) + text.slice(start, end).replace(search, replace) + text.slice(end)
  }
}

interface Slot {
  x: number
}


function isQuoted(text: string, i: Slot, quote: string) {
  return text[i.x] === quote && text[i.x - 1] !== "\\"
}

function* allDoubleQuoted(text: string, i: Slot) {
  yield text[i.x]
  i.x++

  /**
   * Yield until end
   */
  for (; i.x < text.length; i.x++) {
    // TODO: break on newline

    if (isQuoted(text, i, '"')) {
      yield text[i.x]
      i.x++
      break
    }

    yield text[i.x]
  }
}

function* allSingleQuoted(text: string, i: Slot) {
  yield text[i.x]
  i.x++

  /**
   * Yield until end
   */
  for (; i.x < text.length; i.x++) {
    // TODO: break on newline

    if (isQuoted(text, i, "'")) {
      yield text[i.x]
      i.x++
      break
    }

    yield text[i.x]
  }
}

function* allTemplateQuoted(text: string, i: Slot) {
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

function isStartBlockCommented(text: string, i: Slot) {
  return text.slice(i.x, "/*".length) === "/*"
}

function isEndBlockCommented(text: string, i: Slot) {
  return text.slice(i.x, "*/".length) === "*/"
}

function* allBlockCommented(text: string, i: Slot) {
  while (isStartBlockCommented(text, i)) {
    yield text[i.x]
    i.x++

    /**
     * Yield until end
     */
    for (; i.x < text.length; i.x++) {
      if (isEndBlockCommented(text, i)) {
        yield text[i.x]
        i.x++
        break
      }

      yield text[i.x]
    }
  }
}

function isLineCommented(text: string, i: Slot) {
  return text.slice(i.x, "//".length) === "//"
}

function* allLineCommented(text: string, i: Slot) {
  yield text[i.x]
  i.x++

  /**
   * Yield until end
   */
  for (; i.x < text.length; i.x++) {
    if (text[i.x] === "\n") {
      yield text[i.x]
      i.x++
      break
    }

    yield text[i.x]
  }
}

function* allIgnored(text: string, i: Slot) {
  while (true) {
    if (isQuoted(text, i, "`"))
      yield* allTemplateQuoted(text, i)
    else if (isQuoted(text, i, "'"))
      yield* allSingleQuoted(text, i)
    else if (isQuoted(text, i, '"'))
      yield* allDoubleQuoted(text, i)
    else if (isStartBlockCommented(text, i))
      yield* allBlockCommented(text, i)
    else if (isLineCommented(text, i))
      yield* allLineCommented(text, i)
    else
      break
  }
}

function* allLine(text: string, i: Slot) {
  for (; i.x < text.length; i.x++) {
    /**
     * Do not check ignored
     */
    for (const _ of allIgnored(text, i))
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
    for (const _ of allIgnored(text, i))
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

function readCall(text: string, index: number) {
  let call = ""
  let depth = 0

  const i = { x: 0 }

  for (; i.x < text.length; i.x++) {
    for (const _ of allIgnored(text, i))
      continue

    if (i.x < index)
      continue
    if (i.x > index)
      return
    break
  }

  for (; i.x < text.length; i.x++) {
    /**
     * Do not check quoted
     */
    for (const _ of allIgnored(text, i))
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

function readBlock(text: string, index: number) {
  let call = ""
  let depth = 0

  const i = { x: 0 }

  for (; i.x < text.length; i.x++) {
    for (const _ of allIgnored(text, i))
      continue

    if (i.x < index)
      continue
    if (i.x > index)
      return
    break
  }

  for (; i.x < text.length; i.x++) {
    /**
     * Do not check quoted
     */
    for (const _ of allIgnored(text, i))
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

export async function compile(arg: string) {
  const extension = path.extname(arg).slice(1)

  if (!extension)
    throw new Error(`Not a macro file`)

  if (!arg.endsWith(`.macro.${extension}`))
    throw new Error(`Not a macro file`)

  const basename = path.basename(arg, `.macro.${extension}`)
  const filename = path.join(process.cwd(), arg)
  const dirname = path.dirname(filename)

  let text = await fs.readFile(filename, "utf8")

  const imports = new Array<string>()
  const outputByInput = new Map<string, string>()
  const definitionByName = new Map<string, string>()

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
       * Check if CommonJS
       */
      if (typeof require !== "undefined") {
        throw new Error(`CommonJS not supported yet`)
      } else {
        /**
         * Per-call identifier
         */
        const identifier = crypto.randomUUID().split("-")[0]

        const definition = definitionByName.get(name) ?? ""

        const code = ``
          + imports.join("\n")
          + "\n\n"
          + definition
          + "\n\n"
          + `export const output = ${call}`

        await fs.writeFile(`${dirname}/.${identifier}.saumon.${extension}`, code, "utf8")

        let importable: string | undefined

        if (extension === "ts" || extension === "tsx") {
          const program = ts.createProgram([
            `${dirname}/.${identifier}.saumon.${extension}`
          ], {
            module: ts.ModuleKind.NodeNext,
            moduleResolution: ts.ModuleResolutionKind.NodeNext,
            outDir: `${dirname}/.${identifier}.saumon/`
          })

          const preDiagnostics = ts.getPreEmitDiagnostics(program)
          const { emitSkipped, diagnostics } = program.emit()
          const allDiagnostics = [...preDiagnostics, ...diagnostics]

          for (const diagnostic of allDiagnostics) {
            const { file, start, messageText } = diagnostic

            if (file) {
              const { line, character } = ts.getLineAndCharacterOfPosition(file, start!);
              const message = ts.flattenDiagnosticMessageText(messageText, "\n");
              console.warn(`${file.fileName} (${line + 1},${character + 1}): ${message}`);
            } else {
              console.warn(ts.flattenDiagnosticMessageText(messageText, "\n"));
            }
          }

          if (emitSkipped)
            throw new Error(`Transpilation failed`)

          importable = `${dirname}/.${identifier}.saumon/.${identifier}.saumon.js`
        } else {
          importable = `${dirname}/.${identifier}.saumon.${extension}`
        }

        if (importable == null)
          throw new Error(`Could not find file`)

        const { output } = await import(importable)

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

        /**
         * Clean
         */
        await fs.rm(`${dirname}/.${identifier}.saumon.${extension}`, { force: true })
        await fs.rm(`${dirname}/.${identifier}.saumon`, { recursive: true, force: true })

        break
      }
    }

    if (restart)
      continue
    break
  }

  await fs.writeFile(`${dirname}/${basename}.${extension}`, text, "utf8")
}