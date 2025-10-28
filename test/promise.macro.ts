import { $$ } from "@/mods/types/mod.ts";

const x = await $$<Promise<number>>(() => `Promise.resolve(123)`)