)`
}

function $two$() {
  return `${JSON.stringify(crypto.randomUUID())}`
}

$one$($two$())