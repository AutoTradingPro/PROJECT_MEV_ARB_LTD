export function after() {}
export function cookies() {
  return { get: () => undefined, set: () => undefined };
}
export function headers() {
  return new Headers();
}
