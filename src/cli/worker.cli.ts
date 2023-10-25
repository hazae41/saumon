import { compile } from "mods/compiler/index.js";
import { workerData } from "worker_threads";

await compile(workerData)