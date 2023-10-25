export function $imported$(x: any): void {
  return `console.log(${JSON.stringify(x)})` as any
}