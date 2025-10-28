# Saumon 🐟

Ultra simple macro system for TypeScript

```bash
npm install @hazae41/saumon
```

```bash
deno install -gfn saumon -RW jsr:@hazae41/saumon/bin
```

[**📦 NPM**](https://www.npmjs.com/package/@hazae41/saumon) • [**📦 JSR**](https://jsr.io/@hazae41/saumon)

## Goals
- Ultra simple and minimalist
- Ultra fast thanks to [Bun](https://bun.sh)
- Won't interfere with your existing tools
- Can output arbitrary code (TypeScript types, JSX components, JSON data)
- Resistant to supply-chain attacks

## Example

### Compile-time code evaluation

`data.macro.ts` (input)

```tsx
const data = $$(() => fetch("/api/data").then(r => r.json()).then(JSON.stringify))
```

`data.ts` (output)

```tsx
const data = { ... }
```

### Compile-time code generation

`log.macro.ts` (input)

```ts
$$(() => `console.log("hello world")`)
```

`log.ts` (output)

```ts
console.log("hello world")
```

## Usage

A macro is like a regular JS function, but the compiler will replace all its calls by the string value it returns

### CLI

You need to install Deno

```bash
npm install -g deno
```

You can transform a single file

```bash
saumon ./src/test.macro.ts
```

Or a whole directory

```bash
saumon ./src/**/**.macro.ts
```

### Files 

The compiler will only transform files with `.macro.*` extensions

### Definition

All macros must be named with one dollar before and one dollar after their name

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

All comment blocks must start with `/*` or `/**` in the first line and `@macro` in the second line, and end with `*/`

#### You can also inject arbitrary code in the comment block

This instruction will uncomment the given code and reparse the file

`enabled.macro.ts`

```ts
const enabled = true

/**
 * @macro uncomment
 * if (!enabled) {
 *   return exit(0)
 * }
 */
```

`enabled.ts`

```ts
const enabled = true

if (!enabled) {
   return exit(0)
}
```

You can use it to run macros in places where you are not supposed to call functions

`something.macro.ts`

```ts
function $log$(x: string) {
  return `log() {
    console.log("${x}")
  }`
}

class Something {

  /**
   * @macro uncomment
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

#### You can delete lines

This instruction will delete all the lines next to it until `\n\n` (or end of file)

```ts
/**
 * @macro delete-next-lines
 */
console.log("i will be deleted")
console.log("i will be deleted too")
```

You can use it to clean imports that are only used in macros

```ts
/**
 * @macro delete-next-lines
 */
import { $log$ } from "./macros/log.ts"
import { $hello$ } from "./macros/hello.ts"

$log$($hello$())
```

```ts
console.log("hello world")
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

Just return a Promise and the compiler will wait for it

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

#### You can also await macroed code

```ts
function $f$(): Promise<number> {
  return `Promise.resolve(123)` as any
}

await $f$()
```

### Dynamic

You can run dynamic code thanks to callbacks

```tsx
function $run$<T>(callback: () => T): Awaited<T> {
  return (async () => {
    return JSON.stringify(await callback())
  })() as any
}
```

```tsx
const data = $run$(() => fetch("/api/data").then(r => r.json()))
```

For your convenience, Saumon exports the `$run$` macro so you can just import it

```tsx
import { $run$ } from "@hazae41/saumon"
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