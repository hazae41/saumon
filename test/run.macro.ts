declare function $run$<T>(callback: () => T): Awaited<T>

const data = $run$(() => fetch("https://dummyjson.com/products/1").then(r => r.json()))