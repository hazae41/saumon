export const debugging = true

export function $debug$(x: unknown) {
  if (!debugging)
    return
  return `console.debug(${JSON.stringify(x)})`
}