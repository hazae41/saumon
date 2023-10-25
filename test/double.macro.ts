function $one$(x: string) {
  return `console.log(${JSON.stringify(x)})`
}

function $two$() {
  return `${JSON.stringify(crypto.randomUUID())}`
}

$one$($two$())