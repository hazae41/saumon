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

  /**
   * Find where code starts
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

      if (templated)
        continue

      if (lines[i].startsWith("import")) {
        imports.push(lines[i])
        continue
      }

      continue
    }
  }

  /**
   * Apply macros
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

      if (templated)
        continue

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
        delete lines[i]

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

      const match = lines[i].match(/([a-zA-Z0-9.]*\.)?(\$.+\$)(<.+>)?\([^\)]*\)/)

      /**
       * Skip if no macro in this line
       */
      if (match == null)
        continue

      const name = match[2]
      const index = match.index!

      let input = ""
      let depth = 0

      for (let j = index; j < lines[i].length; j++) {

        if (lines[i][j] === "'" && lines[i][j - 1] !== "\\") {
          input += lines[i][j]

          for (j++; j < lines[i].length; j++) {
            input += lines[i][j]

            if (lines[i][j] === "'" && lines[i][j - 1] !== "\\")
              break
            continue
          }

          continue
        }

        if (lines[i][j] === `"` && lines[i][j - 1] !== "\\") {
          input += lines[i][j]

          for (j++; j < lines[i].length; j++) {
            input += lines[i][j]

            if (lines[i][j] === `"` && lines[i][j - 1] !== "\\")
              break
            continue
          }

          continue
        }

        if (lines[i][j] === "`" && lines[i][j - 1] !== "\\") {
          input += lines[i][j]

          for (j++; j < lines[i].length; j++) {
            input += lines[i][j]

            if (lines[i][j] === "`" && lines[i][j - 1] !== "\\")
              break
            continue
          }

          continue
        }

        input += lines[i][j]

        if (lines[i][j] === "(")
          depth++

        if (lines[i][j] === ")") {
          depth--

          if (depth === 0)
            break
          continue
        }

        continue
      }

      /**
       * It's a macro definition
       */
      if (lines[i].includes(`function ${name}`)) {
        let templated = false

        for (let j = i; j < lines.length; j++) {
          if (lines[j] == null)
            continue

          for (let k = 0; k < lines[j].length; k++) {
            if (lines[j][k] === "`" && lines[j][k - 1] !== "\\")
              templated = !templated
            continue
          }

          if (templated)
            continue

          if (lines[j] === "}") {
            /**
             * Save the definition
             */
            const definition = lines.slice(i, j + 1).join("\n")
            definitionByName.set(name, definition)
            break
          }

          continue
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
        lines[i] = lines[i].replaceAll(input, awaited)

        /**
         * Clean
         */
        fs.rmSync(`${dirname}/.${identifier}.saumon.${extension}`)
        fs.rmSync(`${dirname}/.${identifier}.saumon`, { recursive: true, force: true })
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