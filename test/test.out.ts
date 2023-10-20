import { $imported$ } from "./imported.js"

function $test$(x: number): void {
  return `console.log(${x})` as any
}

console.log(123)

function $test2$(name: string): string {
  return `"Hello ${name}"` as any
}

console.log("Hello World")

console.log("it works")