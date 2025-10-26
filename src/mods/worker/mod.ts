import { compile } from "@/mods/compiler/mod.ts";

self.addEventListener("message", async (event: MessageEvent) => {
  const { file, options } = event.data
  await compile(file, options)
  self.postMessage({})
})