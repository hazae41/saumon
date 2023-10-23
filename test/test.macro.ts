import { debugging } from "./debugging.js"
import { $imported$ } from "./imported.js"

$imported$("it works")

function $log$(x: number): void {
  return `console.log(${x})` as any
}

$log$(123)

function $hello$(name: string): string {
  return `"Hello ${name}"` as any
}

console.log($hello$("World"))


function $random$(): number {
  return `${Math.random()}` as any
}

const x = $random$() * 100

function $commented$() {
  return `log(name: string): this {
    console.log(name)
    return this
  }`
}

class Console {

  /**
   * @macro
   * $commented$()
   */

}

function $debug$(x: string) {
  if (!debugging)
    return
  return `console.debug("${x}")`
}

$debug$("test")

function $parse$<T>(x: string): T {
  return JSON.stringify(JSON.parse(x)) as any
}

console.log($parse$<{ id: number }>(`{"id":123}`))

function $fetch$<T>(url: string): T {
  return (async () => {
    const response = await fetch(url)
    const object = await response.json()

    return JSON.stringify(object)
  })() as any
}

console.log($fetch$<{ id: number }>("https://dummyjson.com/products/1"))