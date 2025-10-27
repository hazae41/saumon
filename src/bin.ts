#!/usr/bin/env deno run -RW

// deno-lint-ignore-file no-explicit-any

import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fetch } from "./libs/rpc/mod.ts";
import { parse } from "./mods/compiler/mod.ts";

const args = process.argv.slice(2)

const paths = new Array<string>()

const options: {
  debug?: boolean
} = {}

for (const arg of args) {
  if (arg === "-d" || arg === "--debug") {
    options.debug = true
    continue
  }

  paths.push(arg)
}

const module = new URL("./mods/runner/mod.ts", import.meta.url)

const spawn = async (entrypoint: string) => {
  if (!/\.macro\.(c|m)?(t|j)s(x?)$/.test(entrypoint))
    throw new Error(`Not a macro file`)

  const input = await readFile(entrypoint, "utf8")

  const compiler = parse(input)

  let result = await compiler.next()

  while (result.done === false) {
    using stack = new DisposableStack()

    const code = `const $$ = (callback) => callback(); export const output = await ${result.value};`

    const name = `${crypto.randomUUID().slice(0, 8)}.${path.basename(entrypoint)}`
    const file = path.resolve(path.join(path.dirname(entrypoint), name))

    await writeFile(file, code, "utf8")

    stack.defer(async () => await rm(file, { force: true }))

    const permissions = {
      read: [process.cwd()],
    } as any

    const worker = new Worker(module, {
      type: "module",
      deno: { permissions }
    } as any)

    stack.defer(() => worker.terminate())

    const output = await fetch<string>({
      method: "execute",
      params: [file]
    }, worker).then(r => r.getOrThrow())

    if (typeof output !== "string")
      throw new Error("Macro returned non-string output")

    result = await compiler.next(output)
  }

  const output = result.value

  const extname = path.extname(entrypoint).slice(1)
  const rawname = path.basename(entrypoint, `.macro.${extname}`)

  const exitpoint = path.join(path.dirname(entrypoint), `./${rawname}.${extname}`)

  await writeFile(exitpoint, output, "utf8")
}

const spawns = new Array<Promise<void>>()

for (const path of paths)
  spawns.push(spawn(path))

await Promise.all(spawns)

