
export type UnwrapPromise<T> = T extends PromiseLike<infer U> ? U : T;

export interface ArgPromise<T, U>
{
    args: T,
    result: Promise<U>
}

// good luck
// bind args to a function for delayed execution: bindArgs(function)(...args)()
export const bindArgs = <T extends any[], U>(f: (...args: T) => U): (...x: T) => () => U => (...x: T) => () => f(...x);
