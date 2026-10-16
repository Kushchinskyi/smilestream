// Vite's syntax target does not polyfill built-ins used by dependencies.
// TanStack's serialized-state decoder uses Object.hasOwn (Chrome 93+).
export function ensureTizenBuiltins() {
  if (typeof Object.hasOwn !== "function") {
    Object.defineProperty(Object, "hasOwn", {
      configurable: true,
      writable: true,
      enumerable: false,
      value: (value: unknown, key: PropertyKey) => Object.prototype.hasOwnProperty.call(value, key),
    });
  }
}
