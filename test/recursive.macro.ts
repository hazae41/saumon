function $recursive$(size: number) {
  if (size === 0)
    return `console.log("done")`
  return `$recursive$(${size - 1})`
}

$recursive$(5);