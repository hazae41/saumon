function $commented$() {
  return `  log(name: string): this {
    console.log(name)
    return this
  }`
}

class Console {

  /**
   * @macro uncomment
   * $commented$()
   */ test() {
    return this
  }

}