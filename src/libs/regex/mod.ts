export function getAllRegexes(text: string) {
  const regexes = new Array<[number, number]>()

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

    regexes.push([start, start + regex.length])

    index += match.index + 2
    slice = text.slice(index)
    continue
  }

  return regexes
}