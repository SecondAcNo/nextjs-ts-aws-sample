export type UseCaseSuccess<T> = {
  ok: true;
  value: T;
};

export type UseCaseFailure<E extends string> = {
  ok: false;
  error: E;
};

export type UseCaseResult<T, E extends string> =
  | UseCaseSuccess<T>
  | UseCaseFailure<E>;