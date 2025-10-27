import { fetch } from "@/libs/rpc/mod.ts";
import { compile } from "@/mods/compiler/mod.ts";
import { RpcErr, RpcError, RpcOk, RpcRequest } from "@hazae41/jsonrpc";

self.addEventListener("message", async (event: Event) => {
  const message = event as MessageEvent<string>
  const reqinit = JSON.parse(message.data)

  if ("method" in reqinit === false)
    return

  const request = RpcRequest.from(reqinit)

  if (request.method !== "compile")
    return

  try {
    const [input] = request.params as [string]

    const compiler = compile(input)

    let result = await compiler.next()

    while (result.done === false) {
      const output = await fetch<string>({
        method: "execute",
        params: [`const $$ = (callback) => callback(); export const output = await ${result.value};`]
      }, self).then(r => r.getOrThrow())

      result = await compiler.next(output)
    }

    const output = result.value

    const response = new RpcOk(request.id, output)

    self.postMessage(JSON.stringify(response))
  } catch (e: unknown) {
    const error = RpcError.rewrap(e)

    const response = new RpcErr(request.id, error)

    self.postMessage(JSON.stringify(response))
  }
})