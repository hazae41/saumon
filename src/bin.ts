#!/usr/bin/env deno run -RW

// deno-lint-ignore-file no-explicit-any

import { RpcErr, RpcError, RpcOk, RpcRequest } from "@hazae41/jsonrpc";
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fetch } from "./libs/rpc/mod.ts";

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

const module = new URL("./mods/worker/mod.ts", import.meta.url)

const spawn = async (entrypoint: string) => {
  using stack = new DisposableStack()

  const aborter = new AbortController()
  stack.defer(() => aborter.abort())

  if (!/\.macro\.(c|m)?(t|j)s(x?)$/.test(entrypoint))
    throw new Error(`Not a macro file`)

  const input = await readFile(entrypoint, "utf8")

  const worker = new Worker(module, {
    type: "module",
    deno: { permissions: "none" }
  } as any)

  stack.defer(() => worker.terminate())

  const compile = fetch<string>({
    method: "compile",
    params: [input]
  }, worker, aborter.signal)

  worker.addEventListener("message", async (event) => {
    const message = event as MessageEvent<string>
    const reqinit = JSON.parse(message.data)

    if ("method" in reqinit === false)
      return

    const request = RpcRequest.from(reqinit)

    if (request.method !== "execute")
      return

    try {
      const [code] = request.params as [string]

      const name = `${crypto.randomUUID().slice(0, 8)}.${path.basename(entrypoint)}`
      const file = path.resolve(path.join(path.dirname(entrypoint), name))

      await writeFile(file, code, "utf8")

      stack.defer(async () => await rm(file, { force: true }))

      const { output } = await import(file)

      if (typeof output !== "string")
        throw new Error(`Macro returned ${typeof output} instead of string`)

      const response = new RpcOk(request.id, output)

      worker.postMessage(JSON.stringify(response))
    } catch (e: unknown) {
      const error = RpcError.rewrap(e)

      const response = new RpcErr(request.id, error)

      worker.postMessage(JSON.stringify(response))
    }
  }, { passive: true, signal: aborter.signal })

  const output = await compile.then(r => r.getOrThrow())

  const extname = path.extname(entrypoint).slice(1)
  const rawname = path.basename(entrypoint, `.macro.${extname}`)

  const exitpoint = path.join(path.dirname(entrypoint), `./${rawname}.${extname}`)

  await writeFile(exitpoint, output, "utf8")
}

const spawns = new Array<Promise<void>>()

for (const path of paths)
  spawns.push(spawn(path))

await Promise.all(spawns)

