export const debugging = true

export function $debug$(x: string) {
  if (!debugging)
    return
  return `console.debug("${x}")`
}