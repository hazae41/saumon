declare function $$<T>(callback: () => string): T

$$(() => $$(() => `'console.log("hello world")'`))