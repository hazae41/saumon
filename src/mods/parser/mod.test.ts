import { Cursor } from "../../libs/cursor/mod.ts";

const cursor = new Cursor(`Lorem ipsum.`)

function* g() {
  for (const _ of cursor) {
    yield

    for (const _ of cursor) {
      if (cursor.offset === 3) {
        console.log("BREAK")
        yield
        break
      }
      yield
    }
  }
}

for (const _ of g()) console.log(cursor.offset, cursor.text[cursor.offset])