export class Cursor {

  offset = 0

  #iterator: Iterator<void>

  constructor(
    readonly text: string
  ) {
    this.#iterator = this.#start()
  }

  *#start() {
    for (; this.offset < this.text.length; this.offset++) yield
  }

  next() {
    return this.#iterator.next()
  }

  [Symbol.iterator]() {
    return this
  }

}

export function isEscapedAt(cursor: Cursor) {
  return cursor.text[cursor.offset - 1] === "\\" && cursor.text[cursor.offset - 2] !== "\\"
}

export function isStartBlockCommentedAt(cursor: Cursor) {
  return cursor.text.slice(cursor.offset, cursor.offset + "/*".length) === "/*"
}

export function isEndBlockCommentedAt(cursor: Cursor) {
  return cursor.text.slice(cursor.offset + 1 - "*/".length, cursor.offset + 1) === "*/"
}

export function isLineCommentedAt(cursor: Cursor) {
  return cursor.text.slice(cursor.offset, cursor.offset + "//".length) === "//"
}

export type Slice = [number, number]

export function getSliceAt(cursor: Cursor, slices: Array<Slice>) {
  for (const slice of slices) {
    const [start, end] = slice

    if (cursor.offset < start)
      return

    if (cursor.offset < end)
      return slice

    continue
  }
}