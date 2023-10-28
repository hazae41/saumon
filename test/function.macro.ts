function $run$<T>(callback: () => T): Awaited<T> {
  return (async () => {
    return JSON.stringify(await callback())
  })() as any
}












const data = $run$(() => fetch("/api/data").then(r => r.json()))









data;