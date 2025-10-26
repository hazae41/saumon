declare function $$<T>(callback: () => string): T

export const data = $$<{ id: number }>(() => JSON.stringify(JSON.parse(`{"id":123}`)))