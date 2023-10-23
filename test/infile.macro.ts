function $log$(x: number): void {
  return `console.log(${x})` as any
}

$log$(123)