#!/usr/bin/env deno run -RW

// deno-lint-ignore-file no-explicit-any

import { walk } from "@/libs/fs/mod.ts";
import process from "node:process";

const args = process.argv.slice(2)

const paths = new Array<string>()

const options: {
  recursive?: boolean,
  debug?: boolean
} = {}

for (const arg of args) {
  if (arg === "-r" || arg === "--recursive") {
    options.recursive = true
    continue
  }

  if (arg === "-d" || arg === "--debug") {
    options.debug = true
    continue
  }

  paths.push(arg)
}

const recursive = async (path: string) => {
  for await (const file of walk(path)) {
    const extension = file.split(".").at(-1)

    if (!file.endsWith(`.macro.${extension}`))
      continue
    spawn(file).catch(console.error)
  }
}

const module = new URL("./mods/worker/mod.ts", import.meta.url)

const spawn = async (file: string) => {
  using stack = new DisposableStack()

  const worker = new Worker(module, {
    type: "module",
    deno: { permissions: "none" }
  } as any)

  stack.defer(() => worker.terminate())

  worker.postMessage({ file, options })

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

for (const path of paths) {
  if (options.recursive)
    await recursive(path)
  else
    spawn(path).catch(console.error)
}

