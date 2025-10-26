function $random$() {
  return `${Math.random()}` as any
}

`import

lol`; import { $imported$ } from "./macros/imported.ts";

/**
 * @macro uncomment
 * $imported$(`hello
 * world`)
 */
"lol"; $imported$(`
it works {

  lol
  $imported$("lol")
}`)