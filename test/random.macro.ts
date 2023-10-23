function $random$(): number {
  return `${Math.random()}` as any
}

const x = $random$() * 100