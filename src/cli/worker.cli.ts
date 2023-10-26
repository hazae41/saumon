import { compile } from "mods/compiler/index.js";
import { exit } from "process";
import { workerData } from "worker_threads";

const { file, options } = workerData
await compile(file, options)
exit(0)