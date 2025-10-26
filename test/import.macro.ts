declare function $$<T>(callback: () => Promise<string>): T

$$(async () => await import("./libs/log.ts").then(m => m.$log$("lol")))