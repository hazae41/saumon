declare function $$<T>(callback: () => string): T

console.log(`test {
  ${$$(() => "'lol'")}
}`)