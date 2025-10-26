import { unclosed } from "@/libs/iterable/mod.ts"

export interface Index {
  value: number
}

export function* all(text: string, index: Index) {
  for (; index.value < text.length; index.value++)
    yield
}

export type CharType =
  | "code"
  | "regex"
  | "line-commented"
  | "block-commented"
  | "template-quoted"
  | "single-quoted"
  | "double-quoted"

function isEscaped(text: string, index: Index) {
  return text[index.value - 1] === "\\" && text[index.value - 2] !== "\\"
}

function* allDoubleQuoted(text: string, index: Index, voids: Iterable<void>): Generator<"double-quoted"> {
  const type = "double-quoted"
  yield type

  /**
   * Yield until end
   */
  for (const _ of unclosed(voids)) {
    if (text[index.value] === "\n")
      break

    if (!isEscaped(text, index) && text[index.value] === '"') {
      yield type
      break
    }

    yield type
  }
}

function* allSingleQuoted(text: string, index: Index, voids: Iterable<void>): Generator<"single-quoted"> {
  const type = "single-quoted"
  yield type

  /**
   * Yield until end
   */
  for (const _ of unclosed(voids)) {
    if (text[index.value] === "\n")
      break

    if (!isEscaped(text, index) && text[index.value] === "'") {
      yield type
      break
    }

    yield type
  }
}

function* allTemplateQuoted(text: string, regexes: Array<[number, number]>, index: Index, voids: Iterable<void>): Generator<CharType> {
  const type = "template-quoted"
  yield type

  /**
   * Yield until end
   */
  for (const _ of unclosed(voids)) {
    if (!isEscaped(text, index) && text[index.value] === "$" && text[index.value + 1] === "{") {
      yield type
      index.value++
      yield type

      let depth = 1

      for (const type of allTyped(text, regexes, index, voids)) {
        if (type !== "code") {
          yield type
          continue
        }

        if (text[index.value] === "{") {
          depth++
          yield type
          continue
        }

        if (text[index.value] === "}") {
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

    if (!isEscaped(text, index) && text[index.value] === "`") {
      yield type
      break
    }

    yield type
  }
}

export function isStartBlockCommented(text: string, index: Index) {
  return text.slice(index.value, index.value + "/*".length) === "/*"
}

export function isEndBlockCommented(text: string, index: Index) {
  return text.slice(index.value + 1 - "*/".length, index.value + 1) === "*/"
}

export function* allBlockCommented(text: string, index: Index, voids: Iterable<void>): Generator<"block-commented"> {
  const type = "block-commented"
  yield type

  /**
   * Yield until end
   */
  for (const _ of unclosed(voids)) {
    if (isEndBlockCommented(text, index)) {
      yield type
      break
    }

    yield type
  }
}

function isLineCommented(text: string, index: Index) {
  return text.slice(index.value, index.value + "//".length) === "//"
}

function* allLineCommented(text: string, index: Index, voids: Iterable<void>): Generator<"line-commented"> {
  const type = "line-commented"
  yield type

  /**
   * Yield until end
   */
  for (const _ of unclosed(voids)) {
    if (text[index.value] === "\n")
      break

    yield type
  }
}

export function getRegexes(text: string) {
  const regxs = new Array<[number, number]>()

  let index = 0
  let slice = text

  while (true) {
    const match = slice.match(/(?:(?:^)|(?:\:\s*)|(?:\=\s*)|(?:\(\s*)|(?:return\s*))(\/((?![*+?])(?:[^\r\n\[\/\\]|\\.|\[(?:[^\r\n\]\\]|\\.)*\])+)\/[gimsuy]{0,6})(?:(?:$)|(?:\s*\.)|(?:\s*\,)|(?:\s*\;)|(?:\s*\)))/m)

    if (match == null)
      break
    if (match.index == null)
      break

    const [raw, regex] = match

    try {
      eval(`new RegExp(${regex})`)
    } catch {
      index += match.index + 2
      slice = text.slice(index)
      continue
    }

    const start = index - 1 + match.index + raw.length - regex.length
    regxs.push([start, start + regex.length])

    index += match.index + 2
    slice = text.slice(index)
    continue
  }

  return regxs
}

export function getRegex(regexes: Array<[number, number]>, index: Index) {
  for (const regex of regexes) {
    const [start, end] = regex

    if (index.value < start)
      return

    if (index.value < end)
      return regex

    continue
  }
}

export function* allUntil<T>(index: Index, voids: Iterable<void>, value: T, end: number): Generator<T> {
  for (const _ of unclosed(voids)) {
    if (index.value === end)
      break
    yield value
  }
}

export function* allTyped(text: string, regexes: Array<[number, number]>, index: Index, voids: Iterable<void>): Generator<CharType> {
  for (const _ of unclosed(voids)) {
    if (text[index.value] === "`") {
      yield* allTemplateQuoted(text, regexes, index, voids)
      continue
    }

    if (text[index.value] === "'") {
      yield* allSingleQuoted(text, index, voids)
      continue
    }

    if (text[index.value] === '"') {
      yield* allDoubleQuoted(text, index, voids)
      continue
    }

    if (isStartBlockCommented(text, index)) {
      yield* allBlockCommented(text, index, voids)
      continue
    }

    if (isLineCommented(text, index)) {
      yield* allLineCommented(text, index, voids)
      continue
    }

    const regex = getRegex(regexes, index)

    if (regex != null) {
      const [_start, end] = regex

      yield* allUntil(index, voids, "regex", end)

      continue
    }

    yield "code"
  }
}