import { $imported$ } from "./imported.js"

function $test$(x: number): void {
  return `console.log(${x})` as any
}

$test$(123)

function $test2$(name: string): string {
  return `"Hello ${name}"` as any
}

console.log($test2$("World"))

$imported$("it works")