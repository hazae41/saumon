declare function $$<T>(callback: () => string): T

export const x = $$<number>(() => `${Math.random()}`) * 100