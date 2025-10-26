import fs from "fs/promises"
import path from "path"

export async function* walk(directory: string): AsyncIterable<string> {
  const files = await fs.readdir(directory, { withFileTypes: true })

  for (const file of files) {
    if (file.isDirectory()) {
      yield* walk(path.join(directory, file.name))
    } else {
      yield path.join(directory, file.name)
    }
  }
}

export async function find(directory: string, name: string) {
  for await (const file of walk(directory)) {
    if (path.basename(file) === name)
      return file
  }
}