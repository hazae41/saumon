import { compile } from "mods/compiler/index.js";
import { exit } from "process";
import { workerData } from "worker_threads";

await compile(workerData)
exit(0)