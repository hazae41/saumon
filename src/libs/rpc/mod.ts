import { RpcRequest, type RpcRequestPreinit, RpcResponse } from "@hazae41/jsonrpc";

export interface MessageTarget extends EventTarget {
  postMessage(message: string): void
}

export async function fetch<T>(reqinit: RpcRequestPreinit, target: MessageTarget, signal?: AbortSignal): Promise<RpcResponse<T>> {
  const { id = crypto.randomUUID(), method, params } = reqinit

  using stack = new DisposableStack()

  const aborter = new AbortController()
  stack.defer(() => aborter.abort())

  const future = Promise.withResolvers<RpcResponse<T>>()

  target.addEventListener("message", (event) => {
    const message = event as MessageEvent<string>
    const resinit = JSON.parse(message.data)

    if (resinit.id !== id)
      return

    future.resolve(RpcResponse.from<T>(resinit))
  }, { passive: true, signal: aborter.signal })

  target.addEventListener("error", (event: Event) => {
    future.reject(event)
  }, { passive: true, signal: aborter.signal })

  signal?.addEventListener("abort", () => {
    future.reject(signal.reason)
  }, { passive: true, signal: aborter.signal })

  target.postMessage(JSON.stringify(new RpcRequest(id, method, params)))

  return await future.promise
}