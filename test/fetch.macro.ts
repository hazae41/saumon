declare function $$<T>(callback: () => Promise<string>): T

const data = $$(() => fetch("https://dummyjson.com/products/1").then(r => r.json()).then(JSON.stringify))