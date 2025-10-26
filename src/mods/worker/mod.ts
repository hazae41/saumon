import { compile } from "@/mods/compiler/mod.ts";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

self.addEventListener("message", async (event: MessageEvent) => {
  const { entrypoint } = event.data

  if (!/\.macro\.(c|m)?(t|j)s(x?)$/.test(entrypoint))
    throw new Error(`Not a macro file`)

  const input = await readFile(entrypoint, "utf8")

  const compiler = compile(input)

  let result = await compiler.next()

  while (result.done === false) {
    await using stack = new AsyncDisposableStack()

    const dummy = path.resolve(path.join(path.dirname(entrypoint), `${crypto.randomUUID().slice(0, 8)}.${path.basename(entrypoint)}`))

    await writeFile(dummy, `const $$ = (callback) => callback(); export const output = await ${result.value};`, "utf8")

    stack.defer(async () => await rm(dummy, { force: true }))

    const { output } = await import(dummy)

    if (typeof output !== "string")
      throw new Error(`Macro returned ${typeof output} instead of string`)

    result = await compiler.next(output)
  }

  const output = result.value

  const extname = path.extname(entrypoint).slice(1)
  const rawname = path.basename(entrypoint, `.macro.${extname}`)

  const exitpoint = path.join(path.dirname(entrypoint), `./${rawname}.${extname}`)

  await writeFile(exitpoint, output, "utf8")

  self.postMessage({})
})