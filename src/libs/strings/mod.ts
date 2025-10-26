export namespace Strings {

  export function replaceAt(text: string, search: string, replace: string, start: number, end: number) {
    return text.slice(0, start) + text.slice(start, end).replace(search, replace) + text.slice(end)
  }

}