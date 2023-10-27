export interface Index {
  x: number
}

export type Char =
  | CodeChar
  | TemplateQuotedChar
  | SingleQuotedChar
  | DoubleQuotedChar
  | LineCommentedChar
  | BlockCommentedChar

interface CodeChar {
  readonly type: "code"
  readonly char: string
}

interface LineCommentedChar {
  readonly type: "line-commented"
  readonly char: string
}

interface BlockCommentedChar {
  readonly type: "block-commented"
  readonly char: string
}

interface TemplateQuotedChar {
  readonly type: "template-quoted"
  readonly char: string
}

interface SingleQuotedChar {
  readonly type: "single-quoted"
  readonly char: string
}

interface DoubleQuotedChar {
  readonly type: "double-quoted"
  readonly char: string
}

function isQuoted(text: string, i: Index, quote: string) {
  return text[i.x] === quote && text[i.x - 1] !== "\\"
}

function* allDoubleQuoted(text: string, i: Index): Generator<DoubleQuotedChar> {
  const type = "double-quoted"
  yield { type, char: text[i.x] }
  i.x++

  /**
   * Yield until end
   */
  for (; i.x < text.length; i.x++) {
    if (text[i.x] === "\n")
      break

    if (isQuoted(text, i, '"')) {
      yield { type, char: text[i.x] }
      break
    }

    yield { type, char: text[i.x] }
  }
}

function* allSingleQuoted(text: string, i: Index): Generator<SingleQuotedChar> {
  const type = "single-quoted"
  yield { type, char: text[i.x] }
  i.x++

  /**
   * Yield until end
   */
  for (; i.x < text.length; i.x++) {
    if (text[i.x] === "\n")
      break

    if (isQuoted(text, i, "'")) {
      yield { type, char: text[i.x] }
      break
    }

    yield { type, char: text[i.x] }
  }
}

function* allTemplateQuoted(text: string, i: Index): Generator<TemplateQuotedChar> {
  const type = "template-quoted"
  yield { type, char: text[i.x] }
  i.x++

  /**
   * Yield until end
   */
  for (; i.x < text.length; i.x++) {
    if (isQuoted(text, i, "`")) {
      yield { type, char: text[i.x] }
      break
    }

    yield { type, char: text[i.x] }
  }
}

export function isStartBlockCommented(text: string, i: Index) {
  return text.slice(i.x, i.x + "/*".length) === "/*"
}

export function isEndBlockCommented(text: string, i: Index) {
  return text.slice(i.x + 1 - "*/".length, i.x + 1) === "*/"
}

export function* allBlockCommented(text: string, i: Index): Generator<BlockCommentedChar> {
  const type = "block-commented"
  yield { type, char: text[i.x] }
  i.x++

  /**
   * Yield until end
   */
  for (; i.x < text.length; i.x++) {
    if (isEndBlockCommented(text, i)) {
      yield { type, char: text[i.x] }
      break
    }

    yield { type, char: text[i.x] }
  }
}

function isLineCommented(text: string, i: Index) {
  return text.slice(i.x, i.x + "//".length) === "//"
}

function* allLineCommented(text: string, i: Index): Generator<LineCommentedChar> {
  const type = "line-commented"
  yield { type, char: text[i.x] }
  i.x++

  /**
   * Yield until end
   */
  for (; i.x < text.length; i.x++) {
    if (text[i.x] === "\n")
      break

    yield { type, char: text[i.x] }
  }
}

export function* all(text: string, i: Index): Generator<Char> {
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
      yield { type: "code", char: text[i.x] } as const
  }
}