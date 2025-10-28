import { $$ } from "@/mods/types/mod.ts";

export const x = $$<number>(() => `${Math.random()}`) * 100