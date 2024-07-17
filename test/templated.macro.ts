import { $debug$ } from "./macros/debug.js";

function $stringify$(x: unknown) {
  return `\`${JSON.stringify(x)}\``
}

$debug$(`test {
  ${$stringify$({ hello: true })}
}`)