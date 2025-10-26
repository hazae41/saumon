import { compile } from "@/mods/compiler/mod.ts";
import { exit } from "node:process";
import { workerData } from "node:worker_threads";

const { file, options } = workerData
await compile(file, options)
exit(0)