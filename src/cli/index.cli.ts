import { walkSync } from "libs/walk/walk.js";
import { compile } from "mods/compiler/index.js";

const [node, main, command, ...args] = process.argv

if (command === "build") {
  const paths = new Array<string>()
  const options = { recursive: false }

  for (const arg of args) {
    if (arg === "-r" || arg === "--recursive") {
      options.recursive = true
      continue
    }

    paths.push(arg)
  }

  async function recursive(path: string) {
    for (const file of walkSync(path)) {
      const extension = file.split(".").at(-1)

      if (!file.endsWith(`.macro.${extension}`))
        continue
      compile(file)
    }
  }

  for (const path of paths) {
    if (options.recursive)
      recursive(path)
    else
      compile(path)
  }
} else {
  throw new Error(`Unknown command ${command}`)
}

