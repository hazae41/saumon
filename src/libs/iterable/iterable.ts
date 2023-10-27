export function unclosed<T>(iterable: Iterable<T>) {
  const iterator = iterable[Symbol.iterator]()

  return {
    [Symbol.iterator]() {
      return {
        next: iterator.next.bind(iterator),
      };
    },
  };
}