# Saumon 🍣

Ultra simple macro system for TypeScript

```bash
npm i @hazae41/saumon
```

[**Node Package 📦**](https://www.npmjs.com/package/@hazae41/saumon)

## Goals
- Ultra simple and minimalist
- Works on any runtime (Node, Deno, Bun, browser)
- Can output arbitrary code (TypeScript types, JSX components, JSON data)
- Resistant to supply-chain attacks

## Example

`log.macro.ts`

```ts
function $log$(x: string) {
  return `console.log("${x}")`
}

$log$("hello world")
```

`log.ts`

```ts
console.log("hello world")
```

## Usage

A macro is like a regular JS function, but the preprocessor will replace all its calls by the string value it returns

### Files 

The preprocessor will only transform files with `.macro.ts`, `.macro.js`, `.macro.tsx`, `.macro.jsx` extensions

### Definition

All macros must be regular functions (not arrow), with one dollar before and one dollar after their name

```ts
function $log$(x: string) {
  return `console.log("${x}")`
}
```

### Typing

#### You can spoof the returned type to avoid warnings while you code

```ts
function $random$(): number {
  return `${Math.random()}` as any
}
```

```ts
const x = $random$() * 100
```

### In-file macro

#### You can define and call a macro in the same macro file

```ts
function $log$(x: string) {
  return `console.log("${x}")`
}

$log$("hello world")
```

### Imported macro

#### You can export a macro (from any file) and import it in macro file

`log.ts`

```ts
export function $log$(x: string) {
  return `console.log("${x}")`
}
```

`main.macro.ts`

```ts
import { $log$ } from "./log.ts"

$log$("hello from the main file")
```

#### You can even import macros from libraries

`main.macro.ts`

```ts
import { $log$ } from "some-lib"

$log$("hello from the main file")
```

#### You can also define a macro, export it, and use it in the same macro file

`log.macro.ts`

```ts
export function $log$(x: string) {
  return `console.log("${x}")`
}

$log$("hello from the log file")
```

`main.macro.ts`

```ts
import { $log$ } from "./log.ts"

$log$("hello from the main file")
```

### In-comment macro

#### You can call a macro everywhere with comment blocks

All comment blocks must start with `/**` in the first line and `@macro` in the second line, and end with `*/`

`something.macro.ts`

```ts
function $log$(x: string) {
  return `log() {
    console.log("${x}")
  }`
}

class Something {

  /**
   * @macro 
   * $log$("hello world")
   */

}
```

`something.ts`

```ts
class Something {

  log() {
    console.log("hello world")
  }

}
```

#### You can also inject arbitrary code in the comment block

```ts
const enabled = true

/**
 * @macro
 * if (!enabled) {
 *   return $exit$(0)
 * }
 */
```

### Async

#### You can define and run async macros

`fetch.macro.ts`

```ts
async function $fetch$(url: string) {
  const response = await fetch(url)
  const object = await response.json()

  return `${JSON.stringify(object)}`
}

console.log($fetch$("https://dummyjson.com/products/1"))
```

`fetch.ts`

```ts
console.log({ "id": 1 })
```

#### You can await macroed code

```ts
function $f$(): Promise<number> {
  return `Promise.resolve(123)` as any
}

await $f$()
```

### Constraints

#### Regular functions

Macro functions MUST NOT be arrow functions or anonymous functions

❌

```ts
const $log$ = function () {
  return `console.log("hey")`
}
```

❌

```ts
const $log$ = () => {
  return `console.log("hey")`
}
```

✅

```ts
function $log$() {
  return `console.log("hey")`
}
```

#### Top-level

Macro functions SHOULD be defined at top-level to avoid name conflicts

This is because the parser can't do code analysis to find which macro you want to use

❌

```ts
function f() {

  function $log$() {
    return `console.log("hey")`
  }

  $log$()
}

function g() {

  function $log$() {
    return `console.log("hey")`
  }

  $log$()
}
```

✅

```ts
function $log$() {
  return `console.log("hey")`
}

function f() {
  $log$()
}

function g() {
  $log$()
}
```

#### Scoped variables

All variables MUST be primitive or unscoped

This is because macro definitions and calls are ran isolated from their surrounding code, so they can't access variables defined outside them, but they can still access global variables and imports, so it's not a big deal

❌

```ts
const debugging = true

function $debug$(x: string) {
  if (!debugging)
    return
  return `console.debug("${x}")`
}
```

✅

```ts
import { debugging } from "./debugging.ts"

function $debug$(x: string) {
  if (!debugging)
    return
  return `console.debug("${x}")`
}
```

Passed parameters MUST also be primitive or unscoped (and their type too)

❌

```ts
class X {}

function $log$(i: number, x: X) {
  return `console.log(${i}, "${JSON.stringify(x)}")`
}

$log$(123, new X())
```

✅

```ts
import type { X } from "./x.ts"
import { x } from "./x.ts"

function $log$(i: number, x: X) {
  return `console.log(${i}, "${JSON.stringify(x)}")`
}

$log$(123, x)
```