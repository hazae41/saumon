import { Cursor } from "../../libs/cursor/mod.ts";

const text = `Lorem ipsum.`

const cursor = new Cursor(text)

function* g() {
  for (const _ of cursor) {
    yield

    for (const _ of cursor) {
      if (cursor.offset === 3) {
        yield
        break
      }
      yield
    }
  }
}

for (const _ of g())
  console.log(cursor.offset, text[cursor.offset])