import fs from "fs";
import path from "path";
import ts from "typescript";

export async function compile(arg: string) {
  const extension = arg.split(".").at(-1)

  if (!arg.endsWith(`.macro.${extension}`))
    throw new Error(`Not a macro file`)

  const basename = path.basename(arg, `.macro.${extension}`)
  const filename = path.join(process.cwd(), arg)
  const dirname = path.dirname(filename)

  const input = fs.readFileSync(filename, "utf8")

  const metadata: {
    lastImportLine?: number
  } = {}

  const outputByInput = new Map<string, string>()
  const definitionByName = new Map<string, string>()

  const lines = input.split("\n")

  fs.rmSync(`${dirname}/.saumon`, { recursive: true, force: true })
  fs.mkdirSync(`${dirname}/.saumon`)

  for (let i = 0; i < lines.length; i++) {
    /**
     * Find where code starts
     */
    if (lines[i].startsWith("import")) {
      metadata.lastImportLine = i
      continue
    }

    /**
     * Macro block comment
     */
    if (lines[i].trim().startsWith("* @macro")) {
      /**
       * Delete start
       */
      lines[i - 1] = lines[i - 1].replace("/**", "")

      /**
       * Delete macro attribute
       */
      lines[i] = lines[i].replace("* @macro", "")

      let j = i + 1;

      /**
       * Delete others
       */
      for (; j < lines.length; j++) {
        if (lines[j].trim().startsWith("*/"))
          break
        lines[j] = lines[j].replace("* ", "")
      }

      /**
       * Delete end
       */
      lines[j] = lines[j].replace("*/", "")

      continue
    }

    const match = lines[i].match(/(\$.+\$)(<.+>)?\([^\)]*\)/)

    /**
     * Skip if no macro in this line
     */
    if (match == null)
      continue

    const [input, name] = match

    /**
     * It's a macro definition
     */
    if (lines[i].includes(`function ${name}`)) {
      /**
       * Let's find the end bracket
       */
      for (let j = i; j < lines.length; j++) {
        if (lines[j] === "}") {
          /**
           * Save the definition
           */
          const definition = lines.slice(i, j + 1).join("\n")
          definitionByName.set(name, definition)
          break
        }
      }

      continue
    }

    /**
     * It's a macro call
     */

    /**
     * Check if cached
     */
    {
      const output = outputByInput.get(input)

      if (output != null) {
        lines[i] = lines[i].replaceAll(input, output)
        continue
      }
    }

    /**
     * Per-call identifier
     */
    const identifier = crypto.randomUUID().split("-")[0]

    const { lastImportLine = 0 } = metadata
    const imports = lines.slice(0, lastImportLine + 1).join("\n")

    const definition = definitionByName.get(name) ?? ""

    /**
     * Check if CommonJS
     */
    if (typeof require !== "undefined") {
      throw new Error(`CommonJS not supported yet`)
    } else {
      const code = ``
        + imports
        + "\n\n"
        + definition
        + "\n\n"
        + `export const output = ${input}`

      fs.writeFileSync(`${dirname}/${identifier}.eval.ts`, code, "utf8")

      const { emitSkipped } = ts.createProgram([
        `${dirname}/${identifier}.eval.ts`
      ], {
        module: ts.ModuleKind.ESNext,
        outDir: `${dirname}/.saumon/`
      }).emit()

      if (emitSkipped)
        throw new Error(`Transpilation failed`)

      const { output } = await import(`${dirname}/.saumon/${identifier}.eval.js`)

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
      lines[i] = lines[i].replaceAll(input, awaited)

      /**
       * Clean
       */
      fs.rmSync(`${dirname}/${identifier}.eval.ts`)
    }
  }

  const output = lines.join("\n")

  fs.writeFileSync(`${dirname}/${basename}.ts`, output, "utf8")
  fs.rmSync(`${dirname}/.saumon`, { recursive: true, force: true })
}