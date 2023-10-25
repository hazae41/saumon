export function $imported$(x: unknown): void {
  return `console.log(${JSON.stringify(x)})` as any
}