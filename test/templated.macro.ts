import { $debug$ } from "./macros/debug.ts";

function $stringify$(x: unknown) {
  return `\`${JSON.stringify(x)}\``
}

$debug$(`test {
  ${$stringify$({ hello: true })}
}`)