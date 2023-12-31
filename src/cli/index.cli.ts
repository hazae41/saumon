import { walk } from "libs/fs/fs.js";
import { Worker } from "worker_threads";

const [node, main, command, ...args] = process.argv

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

  async function recursive(path: string) {
    for await (const file of walk(path)) {
      const extension = file.split(".").at(-1)

      if (!file.endsWith(`.macro.${extension}`))
        continue
      spawn(file)
    }
  }

  function spawn(file: string) {
    const workerData = { file, options }
    new Worker(new URL("./worker.cli.js", import.meta.url), { workerData })
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

