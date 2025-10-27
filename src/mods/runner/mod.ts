import { RpcErr, RpcError, RpcOk, RpcRequest } from "@hazae41/jsonrpc";

self.addEventListener("message", async (event: Event) => {
  const message = event as MessageEvent<string>
  const reqinit = JSON.parse(message.data)

  if ("method" in reqinit === false)
    return

  const request = RpcRequest.from(reqinit)

  if (request.method !== "execute")
    return

  try {
    const [input] = request.params as [string]

    const { output } = await import(input)

    const response = new RpcOk(request.id, output)

    self.postMessage(JSON.stringify(response))
  } catch (e: unknown) {
    const error = RpcError.rewrap(e)

    const response = new RpcErr(request.id, error)

    self.postMessage(JSON.stringify(response))
  }
})