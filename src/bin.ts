#!/usr/bin/env deno run -RW

import { walk } from "@/libs/fs/mod.ts";
import process from "node:process";
import { URL } from "node:url";
import { Worker } from "node:worker_threads";

const [command, ...args] = process.argv.slice(2)

if (command === "build") {
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
      spawn(file)
    }
  }

  const spawn = (file: string) => {
    return new Worker(new URL("./worker/mod.ts", import.meta.url), { workerData: { file, options } })
  }

  for (const path of paths) {
    if (options.recursive)
      await recursive(path)
    else
      spawn(path)
  }
} else {
  throw new Error(`Unknown command ${command}`)
}

