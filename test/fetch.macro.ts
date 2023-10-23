function $fetch$<T>(url: string): T {
  return (async () => {
    const response = await fetch(url)
    const object = await response.json()

    return JSON.stringify(object)
  })() as any
}

console.log($fetch$<{ id: number }>("https://dummyjson.com/products/1"))