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