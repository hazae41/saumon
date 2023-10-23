import { walkSync } from "libs/walk/walk.js";
import { compile } from "mods/compiler/index.js";

const [node, main, command, directory] = process.argv

console.log(process.argv)

if (command !== "build")
  throw new Error(`Unknown command ${command}`)

for (const file of walkSync(directory)) {
  const extension = file.split(".").at(-1)

  if (!file.endsWith(`.macro.${extension}`))
    continue
  compile(file)
}