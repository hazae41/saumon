import { getSliceAt, isEndBlockCommentedAt, isEscapedAt, isLineCommentedAt, isStartBlockCommentedAt, type Cursor } from "../cursor/mod.ts";

export type CharType =
  | "code"
  | "regex"
  | "line-commented"
  | "block-commented"
  | "template-quoted"
  | "single-quoted"
  | "double-quoted"

function* loop<T>(cursor: Cursor, value: T, until: number): Generator<T> {
  for (const _ of cursor) {
    if (cursor.offset === until)
      break
    yield value
  }
}

function* allLineCommented(cursor: Cursor): Generator<"line-commented"> {
  const type = "line-commented"

  yield type

  for (const _ of cursor) {
    if (cursor.text[cursor.offset] === "\n")
      break
    yield type
  }
}

export function* allBlockCommented(cursor: Cursor): Generator<"block-commented"> {
  const type = "block-commented"

  yield type

  for (const _ of cursor) {
    if (isEndBlockCommentedAt(cursor)) {
      yield type
      break
    }

    yield type
  }
}

function* allDoubleQuoted(cursor: Cursor): Generator<"double-quoted"> {
  const type = "double-quoted"

  yield type

  for (const _ of cursor) {
    if (cursor.text[cursor.offset] === "\n")
      break

    if (!isEscapedAt(cursor) && cursor.text[cursor.offset] === '"') {
      yield type
      break
    }

    yield type
  }
}

function* allSingleQuoted(cursor: Cursor): Generator<"single-quoted"> {
  const type = "single-quoted"

  yield type

  for (const _ of cursor) {
    if (cursor.text[cursor.offset] === "\n")
      break

    if (!isEscapedAt(cursor) && cursor.text[cursor.offset] === "'") {
      yield type
      break
    }

    yield type
  }
}

function* allTemplateQuoted(cursor: Cursor, regexes: Array<[number, number]>): Generator<CharType> {
  const type = "template-quoted"

  yield type

  for (const _ of cursor) {
    if (!isEscapedAt(cursor) && cursor.text[cursor.offset] === "$" && cursor.text[cursor.offset + 1] === "{") {
      yield type
      cursor.offset++
      yield type

      let depth = 1

      for (const type of chars(cursor, regexes)) {
        if (type !== "code") {
          yield type
          continue
        }

        if (cursor.text[cursor.offset] === "{") {
          depth++
          yield type
          continue
        }

        if (cursor.text[cursor.offset] === "}") {
          depth--

          if (depth === 0)
            break

          yield type
          continue
        }

        yield type
        continue
      }

      yield type
      continue
    }

    if (!isEscapedAt(cursor) && cursor.text[cursor.offset] === "`") {
      yield type
      break
    }

    yield type
  }
}

export function* chars(cursor: Cursor, regexes: Array<[number, number]>): Generator<CharType> {
  for (const _ of cursor) {
    if (cursor.text[cursor.offset] === "`") {
      yield* allTemplateQuoted(cursor, regexes)
      continue
    }

    if (cursor.text[cursor.offset] === "'") {
      yield* allSingleQuoted(cursor)
      continue
    }

    if (cursor.text[cursor.offset] === '"') {
      yield* allDoubleQuoted(cursor)
      continue
    }

    if (isStartBlockCommentedAt(cursor)) {
      yield* allBlockCommented(cursor)
      continue
    }

    if (isLineCommentedAt(cursor)) {
      yield* allLineCommented(cursor)
      continue
    }

    const regex = getSliceAt(cursor, regexes)

    if (regex != null) {
      const [_start, end] = regex

      yield* loop(cursor, "regex", end)

      continue
    }

    yield "code"
  }
}