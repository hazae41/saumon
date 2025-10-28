export function unclose<T>(iterable: Iterable<T>) {
  const iterator = iterable[Symbol.iterator]()
  const next = iterator.next.bind(iterator)

  return {
    [Symbol.iterator]() {
      return { next }
    }
  }
}