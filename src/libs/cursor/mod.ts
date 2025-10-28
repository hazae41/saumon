export interface Cursor {
  value: number
}

export function* curse(text: string, cursor: Cursor): Iterable<void> {
  for (; cursor.value < text.length; cursor.value++)
    yield
}

export function isEscapedAt(text: string, cursor: Cursor) {
  return text[cursor.value - 1] === "\\" && text[cursor.value - 2] !== "\\"
}

export function isStartBlockCommentedAt(text: string, cursor: Cursor) {
  return text.slice(cursor.value, cursor.value + "/*".length) === "/*"
}

export function isEndBlockCommentedAt(text: string, cursor: Cursor) {
  return text.slice(cursor.value + 1 - "*/".length, cursor.value + 1) === "*/"
}

export function isLineCommentedAt(text: string, cursor: Cursor) {
  return text.slice(cursor.value, cursor.value + "//".length) === "//"
}

export type Slice = [number, number]

export function getSliceAt(slices: Array<Slice>, cursor: Cursor) {
  for (const slice of slices) {
    const [start, end] = slice

    if (cursor.value < start)
      return

    if (cursor.value < end)
      return slice

    continue
  }
}