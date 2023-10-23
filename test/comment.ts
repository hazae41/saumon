function $commented$() {
  return `log(name: string): this {
    console.log(name)
    return this
  }`
}

class Console {

  
   
   log(name: string): this {
    console.log(name)
    return this
  }
   

}