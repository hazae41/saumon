/**
 * @macro delete-next-lines
 */
import { $run$ } from "index.js";

const data = $run$(() => fetch("https://dummyjson.com/products/1").then(r => r.json()))