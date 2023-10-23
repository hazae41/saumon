# Saumon 🐟

Ultra simple macro system for TypeScript

```bash
npm i @hazae41/saumon
```

[**Node Package 📦**](https://www.npmjs.com/package/@hazae41/saumon)

## Summary
- [Goals](#goals)
- [Example](#example)
- [Usage](#usage)
- [Security](#security)

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

#### You can export a macro (from any file) and import it in a macro file

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

### Comment blocks

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

### Generic

#### You can use generic macro functions

`parse.macro.ts`

```ts
function $parse$<T>(x: string): T {
  return JSON.stringify(JSON.parse(x)) as any
}

export const data = $parse$<{ id: number }>(`{"id":123}`)
```

`parse.ts`

```ts
export const data = {"id":123}
```

### Async

#### You can define and run async macros

Just return a Promise and the preprocessor will wait for it

`fetch.macro.ts`

```ts
function $fetch$<T>(url: string): T {
  return (async () => {
    const response = await fetch(url)
    const object = await response.json()

    return JSON.stringify(object)
  })() as any
}

export const data = $fetch$<{ id: number }>("https://dummyjson.com/products/1")
```

`fetch.ts`

```ts
export const data = { "id": 1 }
```

#### You can await macroed code

```ts
function $f$(): Promise<number> {
  return `Promise.resolve(123)` as any
}

await $f$()
```

### Constraints on in-file macro calls

Those constraints only apply when calling in-file macros, not when calling imported macros

#### Regular functions

When calling an in-file macro, it MUST be defined as a regular function

❌

```ts
export const $log$ = function () {
  return `console.log("hey")`
}
```

❌

```ts
export const $log$ = () => {
  return `console.log("hey")`
}
```

✅

```ts
export function $log$() {
  return `console.log("hey")`
}
```

#### Top-level definition

When calling an in-file macro, it SHOULD be defined at top-level to avoid name conflicts

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

#### Local variables

When calling a macro in-file, variables MUST be primitive, global, or imported

This is because macro definitions and calls are ran isolated from their surrounding code

They can still access global variables and imports

❌ Calling an in-file macro that uses local variables

```ts
const debugging = true

function $debug$(x: string) {
  if (!debugging)
    return
  return `console.debug("${x}")`
}

$debug$("hey")
```

✅ Calling an in-file macro that uses global or imported variables

```ts
import { debugging } from "./debugging.ts"

function $debug$(x: string) {
  if (!debugging)
    return
  return `console.debug("${x}")`
}

$debug$("hey")
```

✅ Calling an imported macro

`debug.ts`

```ts
const debugging = true

export function $debug$(x: string) {
  if (!debugging)
    return
  return `console.debug("${x}")`
}
```

`main.macro.ts`

```ts
import { $debug$ } from "./debug.ts"

$debug$("hey")
```

Similarly, passed parameters MUST also be primitive, global, or imported (and their type too)

❌ Calling an in-file macro whose parameters are local

```ts
class X {}

function $log$(i: number, x: X) {
  return `console.log(${i}, "${JSON.stringify(x)}")`
}

$log$(123, new X())
```

✅ Calling an in-file macro whose parameters are imported

```ts
import type { X } from "./x.ts"
import { x } from "./x.ts"

function $log$(i: number, x: X) {
  return `console.log(${i}, "${JSON.stringify(x)}")`
}

$log$(123, x)
```

✅ Calling an imported macro

`log.ts`

```ts
export class X {}

export function $log$(i: number, x: X) {
  return `console.log(${i}, "${JSON.stringify(x)}")`
}

$log$(123, new X())
```

`main.macro.ts`

```ts
import { $log$, X } from "./log.ts"

$log$(123, new X())
```

## Security

Macro files are transformed ahead-of-time by the developer.

This means the output code is fully available in the Git, and won't interfere with code analysis tools.

The macro code SHOULD only be transformed when needed (e.g. when modified, when the fetched data is stale), and its output SHOULD be verified by the developer.

The developer SHOULD also provide the input macro file in the Git, so its output can be reproducible by people and automated tools.