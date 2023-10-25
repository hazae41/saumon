function $inception$() {
  return `function $inner$() {
    return \`console.log("lol")\`
  }
  
  $inner$()`
}

$inception$()