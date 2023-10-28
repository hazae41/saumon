export function $run$<T>(callback: () => T): Awaited<T> {
  return (async () => {
    return JSON.stringify(await callback())
  })() as any
}