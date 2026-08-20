export interface Disposable {
  dispose(): void;
}

/** A disposable that owns other disposables. Dispose once, dispose all. */
export interface DisposableBag extends Disposable {
  add<T extends Disposable>(d: T): T;
}
