import { unclosed } from "libs/iterable/iterable.js"

export interface Index {
  x: number
}

export function* raw(text: string, i: Index) {
  for (; i.x < text.length; i.x++)
    yield
}

export type CharType =
  | "code"
  | "line-commented"
  | "block-commented"
  | "template-quoted"
  | "single-quoted"
  | "double-quoted"

function isEscaped(text: string, i: Index) {
  return text[i.x - 1] === "\\" && text[i.x - 2] !== "\\"
}

function* allDoubleQuoted(text: string, i: Index, r: Iterable<void>): Generator<"double-quoted"> {
  const type = "double-quoted"
  yield type

  /**
   * Yield until end
   */
  for (const _ of unclosed(r)) {
    if (text[i.x] === "\n")
      break

    if (!isEscaped(text, i) && text[i.x] === '"') {
      yield type
      break
    }

    yield type
  }
}

function* allSingleQuoted(text: string, i: Index, r: Iterable<void>): Generator<"single-quoted"> {
  const type = "single-quoted"
  yield type

  /**
   * Yield until end
   */
  for (const _ of unclosed(r)) {
    if (text[i.x] === "\n")
      break

    if (!isEscaped(text, i) && text[i.x] === "'") {
      yield type
      break
    }

    yield type
  }
}

function* allTemplateQuoted(text: string, i: Index, r: Iterable<void>): Generator<CharType> {
  const type = "template-quoted"
  yield type

  /**
   * Yield until end
   */
  for (const _ of unclosed(r)) {
    if (!isEscaped(text, i) && text[i.x] === "$" && text[i.x + 1] === "{") {
      yield type
      i.x++
      yield type

      let depth = 1

      for (const type of typed(text, i, r)) {
        if (type !== "code") {
          yield type
          continue
        }

        if (text[i.x] === "{") {
          depth++
          yield type
          continue
        }

        if (text[i.x] === "}") {
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

    if (!isEscaped(text, i) && text[i.x] === "`") {
      yield type
      break
    }

    yield type
  }
}

export function isStartBlockCommented(text: string, i: Index) {
  return text.slice(i.x, i.x + "/*".length) === "/*"
}

export function isEndBlockCommented(text: string, i: Index) {
  return text.slice(i.x + 1 - "*/".length, i.x + 1) === "*/"
}

export function* allBlockCommented(text: string, i: Index, r: Iterable<void>): Generator<"block-commented"> {
  const type = "block-commented"
  yield type

  /**
   * Yield until end
   */
  for (const _ of unclosed(r)) {
    if (isEndBlockCommented(text, i)) {
      yield type
      break
    }

    yield type
  }
}

function isLineCommented(text: string, i: Index) {
  return text.slice(i.x, i.x + "//".length) === "//"
}

function* allLineCommented(text: string, i: Index, r: Iterable<void>): Generator<"line-commented"> {
  const type = "line-commented"
  yield type

  /**
   * Yield until end
   */
  for (const _ of unclosed(r)) {
    if (text[i.x] === "\n")
      break

    yield type
  }
}

export function isRegex(text: string, i: Index) {
  return text[i.x] === "/"
}

export function* typed(text: string, i: Index, r: Iterable<void>): Generator<CharType> {
  for (const _ of unclosed(r)) {
    if (text[i.x] === "`")
      yield* allTemplateQuoted(text, i, r)
    else if (text[i.x] === "'")
      yield* allSingleQuoted(text, i, r)
    else if (text[i.x] === '"')
      yield* allDoubleQuoted(text, i, r)
    else if (isStartBlockCommented(text, i))
      yield* allBlockCommented(text, i, r)
    else if (isLineCommented(text, i))
      yield* allLineCommented(text, i, r)
    else
      yield "code"
  }
}