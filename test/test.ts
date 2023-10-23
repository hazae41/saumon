import { debugging } from "./debugging.js"
import { $imported$ } from "./imported.js"

console.log("it works")

function $log$(x: number): void {
  return `console.log(${x})` as any
}

console.log(123)

function $hello$(name: string): string {
  return `"Hello ${name}"` as any
}

console.log("Hello World")


function $random$(): number {
  return `${Math.random()}` as any
}

const x = 0.08816049746316335 * 100

function $commented$() {
  return `log(name: string): this {
    console.log(name)
    return this
  }`
}

class Console {

  
   
   log(name: string): this {
    console.log(name)
    return this
  }
   

}

function $debug$(x: string) {
  if (!debugging)
    return
  return `console.debug("${x}")`
}

console.debug("test")

function $parse$<T>(x: string): T {
  return JSON.stringify(JSON.parse(x)) as any
}

console.log({"id":123})

function $fetch$<T>(url: string): T {
  return (async () => {
    const response = await fetch(url)
    const object = await response.json()

    return JSON.stringify(object)
  })() as any
}

console.log({"id":1,"title":"iPhone 9","description":"An apple mobile which is nothing like apple","price":549,"discountPercentage":12.96,"rating":4.69,"stock":94,"brand":"Apple","category":"smartphones","thumbnail":"https://i.dummyjson.com/data/products/1/thumbnail.jpg","images":["https://i.dummyjson.com/data/products/1/1.jpg","https://i.dummyjson.com/data/products/1/2.jpg","https://i.dummyjson.com/data/products/1/3.jpg","https://i.dummyjson.com/data/products/1/4.jpg","https://i.dummyjson.com/data/products/1/thumbnail.jpg"]})