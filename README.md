# Saumon 🐟

Ultra simple macro system for TypeScript

```bash
npm install -D @hazae41/saumon
```

[**📦 NPM**](https://www.npmjs.com/package/@hazae41/saumon)

## Goals
- Ultra simple and minimalist
- Secured with Deno permissions
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
import { $$ } from "@hazae41/saumon"

$$(() => `console.log("hello world")`)
```

`log.ts` (output)

```ts
console.log("hello world")
```

## Setup

### With Deno and NPM (local install)

Install Deno and Saumon locally

```bash
npm install -D deno @hazae41/saumon
```

Write your script with Deno

```json
"scripts": {
  "generate": "deno x --unstable-worker-options saumon ./src/**/**"
}
```

Run your script

```bash
npm run generate
```

### With Bun and NPM (local install)

Install Bun and Saumon locally

```bash
npm install -D bun @hazae41/saumon
```

Write your script with Bun

```json
"scripts": {
  "generate": "bun x --bun saumon ./src/**/**"
}
```

Run your script

```bash
npm run generate
```

### With Deno (global install) (not recommended)

Install Deno globally

```bash
npm install -g deno
```

Install Saumon globally with Deno

```bash
deno install -gf -RW --unstable-worker-options npm:@hazae41/saumon
```

Run Saumon with Deno

```bash
saumon ./src/**/**
```

### With Deno (just-in-time) (not recommended)

Install Deno globally

```bash
npm install -g deno
```

Run Saumon with Deno

```bash
deno x --unstable-worker-options -RW npm:@hazae41/saumon ./src/**/**
```

### With Bun (just-in-time) (not recommended)

Install Bun globally

```bash
npm install -g bun
```

Run Saumon with Bun

```bash
bun x --bun @hazae41/saumon ./src/**/**
```

## Usage

A macro is like a regular JS function, but the compiler will replace all its calls by the string value it returns

### CLI

You can transform a single file

```bash
saumon ./src/test.macro.ts
```

Or a whole directory

```bash
saumon ./src/**/**
```

### Files 

The compiler will only transform files with `.macro.*` extensions

This is good for performances because it won't parse all your code

And this is good for security because it will only run code in there

### Typing

All macros must be called with `$$(() => Awaitable<string>)`

```ts
export declare function $$<T>(f: () => Awaitable<string>): T
```

You can spoof the returned type to avoid warnings while you code

```ts
const x = $$<number>(() => `${Math.random()}`) * 100
```

### Imports

#### You can import anything in a macro call

`log.ts`

```ts
export function $log$(x: string) {
  return `console.log("${x}")`
}
```

`main.macro.ts`

```ts
import { $$ } from "@hazae41/saumon"

$$(async () => {
  const { $log$ } = await import("./log.ts")

  return $log$("hello world")
})
```

#### You can even import things from libraries

`main.macro.ts`

```ts
import { $$ } from "@hazae41/saumon"

$$(async () => {
  const { $log$ } = await import("some-lib")

  return $log$("hello world")
})
```

### Async

#### You can define and run async macros

Just return a Promise and the compiler will wait for it

`fetch.macro.ts`

```ts
import { $$ } from "@hazae41/saumon"

const data = $$(() => fetch("https://dummyjson.com/products/1").then(r => r.json()).then(JSON.stringify))
```

`fetch.ts`

```ts
export const data = { "id": 1 }
```

#### You can also await macroed code

`promise.macro.ts`

```ts
import { $$ } from "@hazae41/saumon"

const x = await $$<Promise<number>>(() => `Promise.resolve(123)`)
```

`promise.ts`

```tsx
const x = await Promise.resolve(123)
```

#### Shared variables

When calling a macro, in-file local variables are NOT accessible

This is because macro calls are ran isolated from their surrounding code (in a worker)

They can still access imports, so you can put shared things in some file, and/or pass them

`x.ts`

```ts
export const x = Math.random()
```

`main.macro.ts`

```ts
import { $$ } from "@hazae41/saumon"

const x = $$<number>(async () => {
  const { x } = await import("./x.ts")

  console.log(`x is ${x}`)

  return `${x}`
})

console.log(`x is ${x}`) // exact same as above
```

### Permissions

If you use Deno as your runtime, you can benefit from it's permissions based-security

```bash
$ deno run -RW ./src/bin.ts ./test/fetch.macro.ts
┏ ⚠️  Deno requests net access to "dummyjson.com:443".
┠─ Requested by `fetch()` API.
┠─ To see a stack trace for this prompt, set the DENO_TRACE_PERMISSIONS environmental variable.
┠─ Learn more at: https://docs.deno.com/go/--allow-net
┠─ Run again with --allow-net to bypass this prompt.
┗ Allow? [y/n/A] (y = yes, allow; n = no, deny; A = allow all net permissions) > y
```

```bash
✅ Granted net access to "dummyjson.com:443".
```

Each macro call will have its own independent permissions

So when you type `A` it's always within the same macro call

## Security

Macro files are transformed ahead-of-time by the developer.

This means the output code is fully available in the Git, and won't interfere with code analysis tools.

The macro code SHOULD only be transformed when needed (e.g. when modified, when the fetched data is stale), and its output SHOULD be verified by the developer.

The developer SHOULD also provide the input macro file in the Git, so its output can be reproducible by people and automated tools.