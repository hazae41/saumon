import { $$ } from "@/mods/types/mod.ts";

$$(async () => await import("./libs/log.ts").then(m => m.$log$("lol")))