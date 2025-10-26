#!/usr/bin/env deno run -RW

// deno-lint-ignore-file no-explicit-any

import process from "node:process";

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

  const worker = new Worker(module, {
    type: "module",
    deno: { permissions: "none" }
  } as any)

  stack.defer(() => worker.terminate())

  worker.postMessage({ entrypoint })

  const future = Promise.withResolvers<void>()

  const aborter = new AbortController()
  stack.defer(() => aborter.abort())

  worker.addEventListener("message", () => {
    future.resolve()
  }, { passive: true, signal: aborter.signal })

  worker.addEventListener("error", (event: Event) => {
    future.reject(event)
  }, { passive: true, signal: aborter.signal })

  await future.promise
}

const spawns = new Array<Promise<void>>()

for (const path of paths)
  spawns.push(spawn(path))

await Promise.all(spawns)

