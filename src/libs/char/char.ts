export interface Index {
  x: number
}

export type CharType =
  | "code"
  | "line-commented"
  | "block-commented"
  | "template-quoted"
  | "single-quoted"
  | "double-quoted"

function isQuoted(text: string, i: Index, quote: string) {
  return text[i.x] === quote && text[i.x - 1] !== "\\"
}

function* allDoubleQuoted(text: string, i: Index): Generator<"double-quoted"> {
  const type = "double-quoted"
  yield type
  i.x++

  /**
   * Yield until end
   */
  for (; i.x < text.length; i.x++) {
    if (text[i.x] === "\n")
      break

    if (isQuoted(text, i, '"')) {
      yield type
      break
    }

    yield type
  }
}

function* allSingleQuoted(text: string, i: Index): Generator<"single-quoted"> {
  const type = "single-quoted"
  yield type
  i.x++

  /**
   * Yield until end
   */
  for (; i.x < text.length; i.x++) {
    if (text[i.x] === "\n")
      break

    if (isQuoted(text, i, "'")) {
      yield type
      break
    }

    yield type
  }
}

function* allTemplateQuoted(text: string, i: Index): Generator<CharType> {
  const type = "template-quoted"
  yield type
  i.x++

  /**
   * Yield until end
   */
  for (; i.x < text.length; i.x++) {
    if (text[i.x] === "$" && text[i.x - 1] !== "\\" && text[i.x + 1] === "{") {
      yield type
      i.x++
      yield type
      i.x++

      let depth = 1

      for (const type of allTyped(text, i)) {
        yield type

        if (type !== "code")
          continue

        if (text[i.x] === "{") {
          depth++
          continue
        }

        if (text[i.x] === "}") {
          depth--

          if (depth === 0)
            break
          continue
        }

        continue
      }

      continue
    }

    if (isQuoted(text, i, "`")) {
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

export function* allBlockCommented(text: string, i: Index): Generator<"block-commented"> {
  const type = "block-commented"
  yield type
  i.x++

  /**
   * Yield until end
   */
  for (; i.x < text.length; i.x++) {
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

function* allLineCommented(text: string, i: Index): Generator<"line-commented"> {
  const type = "line-commented"
  yield type
  i.x++

  /**
   * Yield until end
   */
  for (; i.x < text.length; i.x++) {
    if (text[i.x] === "\n")
      break

    yield type
  }
}

export function* allRaw(text: string, i: Index) {
  for (; i.x < text.length; i.x++)
    yield
}

export function* allTyped(text: string, i: Index): Generator<CharType> {
  for (; i.x < text.length; i.x++) {
    if (isQuoted(text, i, "`"))
      yield* allTemplateQuoted(text, i)
    else if (isQuoted(text, i, "'"))
      yield* allSingleQuoted(text, i)
    else if (isQuoted(text, i, '"'))
      yield* allDoubleQuoted(text, i)
    else if (isStartBlockCommented(text, i))
      yield* allBlockCommented(text, i)
    else if (isLineCommented(text, i))
      yield* allLineCommented(text, i)
    else
      yield "code"
  }
}