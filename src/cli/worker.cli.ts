import { compile } from "@/mods/compiler/index.ts";
import { exit } from "process";
import { workerData } from "worker_threads";

const { file, options } = workerData
await compile(file, options)
exit(0)