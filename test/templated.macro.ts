import { $debug$ } from "./macros/debug.js";

$debug$(`test {
  ${$debug$({ "hello": "world" })}
}`)