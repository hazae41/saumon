export function unclose<T>(iterable: Iterable<T>): Iterable<T> {
  return new Unclosable(iterable[Symbol.iterator]())
}

export class Unclosable<T> {

  constructor(
    readonly iterator: Iterator<T>
  ) { }

  next(): IteratorResult<T> {
    return this.iterator.next()
  }

  [Symbol.iterator](): Iterator<T> {
    return this
  }

}