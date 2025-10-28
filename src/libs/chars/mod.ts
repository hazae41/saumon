import { unclose } from "@/libs/iterable/mod.ts";
import { getSliceAt, isEndBlockCommentedAt, isEscapedAt, isLineCommentedAt, isStartBlockCommentedAt, type Cursor } from "../cursor/mod.ts";

export type CharType =
  | "code"
  | "regex"
  | "line-commented"
  | "block-commented"
  | "template-quoted"
  | "single-quoted"
  | "double-quoted"

export function* loop<T>(cursor: Cursor, cursed: Iterable<void>, value: T, until: number): Generator<T> {
  for (const _ of unclose(cursed)) {
    if (cursor.value === until)
      break
    yield value
  }
}

function* allLineCommented(text: string, cursor: Cursor, cursed: Iterable<void>): Generator<"line-commented"> {
  const type = "line-commented"
  yield type

  /**
   * Yield until end
   */
  for (const _ of unclose(cursed)) {
    if (text[cursor.value] === "\n")
      break

    yield type
  }
}

export function* allBlockCommented(text: string, cursor: Cursor, cursed: Iterable<void>): Generator<"block-commented"> {
  const type = "block-commented"
  yield type

  /**
   * Yield until end
   */
  for (const _ of unclose(cursed)) {
    if (isEndBlockCommentedAt(text, cursor)) {
      yield type
      break
    }

    yield type
  }
}

function* allDoubleQuoted(text: string, cursor: Cursor, cursed: Iterable<void>): Generator<"double-quoted"> {
  const type = "double-quoted"
  yield type

  /**
   * Yield until end
   */
  for (const _ of unclose(cursed)) {
    if (text[cursor.value] === "\n")
      break

    if (!isEscapedAt(text, cursor) && text[cursor.value] === '"') {
      yield type
      break
    }

    yield type
  }
}

function* allSingleQuoted(text: string, cursor: Cursor, cursed: Iterable<void>): Generator<"single-quoted"> {
  const type = "single-quoted"
  yield type

  /**
   * Yield until end
   */
  for (const _ of unclose(cursed)) {
    if (text[cursor.value] === "\n")
      break

    if (!isEscapedAt(text, cursor) && text[cursor.value] === "'") {
      yield type
      break
    }

    yield type
  }
}

function* allTemplateQuoted(text: string, cursor: Cursor, cursed: Iterable<void>, regexes: Array<[number, number]>): Generator<CharType> {
  const type = "template-quoted"
  yield type

  /**
   * Yield until end
   */
  for (const _ of unclose(cursed)) {
    if (!isEscapedAt(text, cursor) && text[cursor.value] === "$" && text[cursor.value + 1] === "{") {
      yield type
      cursor.value++
      yield type

      let depth = 1

      for (const type of all(text, cursor, cursed, regexes)) {
        if (type !== "code") {
          yield type
          continue
        }

        if (text[cursor.value] === "{") {
          depth++
          yield type
          continue
        }

        if (text[cursor.value] === "}") {
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

    if (!isEscapedAt(text, cursor) && text[cursor.value] === "`") {
      yield type
      break
    }

    yield type
  }
}

export function* all(text: string, cursor: Cursor, cursed: Iterable<void>, regexes: Array<[number, number]>): Generator<CharType> {
  for (const _ of unclose(cursed)) {
    if (text[cursor.value] === "`") {
      yield* allTemplateQuoted(text, cursor, cursed, regexes)
      continue
    }

    if (text[cursor.value] === "'") {
      yield* allSingleQuoted(text, cursor, cursed)
      continue
    }

    if (text[cursor.value] === '"') {
      yield* allDoubleQuoted(text, cursor, cursed)
      continue
    }

    if (isStartBlockCommentedAt(text, cursor)) {
      yield* allBlockCommented(text, cursor, cursed)
      continue
    }

    if (isLineCommentedAt(text, cursor)) {
      yield* allLineCommented(text, cursor, cursed)
      continue
    }

    const regex = getSliceAt(regexes, cursor)

    if (regex != null) {
      const [_start, end] = regex

      yield* loop(cursor, cursed, "regex", end)

      continue
    }

    yield "code"
  }
}