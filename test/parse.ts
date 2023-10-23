function $parse$<T>(x: string): T {
  return JSON.stringify(JSON.parse(x)) as any
}

console.log({"id":123})