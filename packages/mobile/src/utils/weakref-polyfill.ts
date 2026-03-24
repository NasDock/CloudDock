// Minimal WeakRef polyfill for Hermes environments without WeakRef.
// It does NOT provide real GC semantics but prevents crashes in libs that
// only use WeakRef opportunistically.
if (typeof (globalThis as any).WeakRef === 'undefined') {
  class WeakRefPolyfill<T extends object> {
    private _value: T | undefined;
    constructor(value: T) {
      this._value = value;
    }
    deref(): T | undefined {
      return this._value;
    }
  }

  (globalThis as any).WeakRef = WeakRefPolyfill;
}

