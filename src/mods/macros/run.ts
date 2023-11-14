export interface RunOptions {
  readonly space?: number
}

export function $run$<T>(callback: () => T, options: RunOptions = {}): Awaited<T> {
  const { space = 2 } = options

  return (async () => {
    return JSON.stringify(await callback(), undefined, space)
  })() as any
}