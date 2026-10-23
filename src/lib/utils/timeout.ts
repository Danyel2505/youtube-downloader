function waitForTimeout(milliseconds: number) {
  return new Promise<void>(resolve => {
    AbortSignal.timeout(milliseconds).addEventListener("abort", () => resolve(), { once: true });
  });
}

function raceAgainstTimeout<T>({ promise, milliseconds }: {
  promise: Promise<T>;
  milliseconds: number;
}) {
  return Promise.race([
    promise.then(value => ({
      isTimedOut: false as const,
      value
    })),
    waitForTimeout(milliseconds).then(() => ({ isTimedOut: true as const }))
  ]);
}

// Settles with the promise, or with the fallback once the time is up
export async function resolveWithin<T, Fallback>({ promise, milliseconds, fallback }: {
  promise: Promise<T>;
  milliseconds: number;
  fallback: Fallback;
}) {
  const outcome = await raceAgainstTimeout({
    promise,
    milliseconds
  });
  return outcome.isTimedOut ? fallback : outcome.value;
}

// Settles with the promise, or rejects with the message once the time is up
export async function rejectAfter<T>({ promise, milliseconds, message }: {
  promise: Promise<T>;
  milliseconds: number;
  message: string;
}) {
  const outcome = await raceAgainstTimeout({
    promise,
    milliseconds
  });
  if (outcome.isTimedOut) {
    throw new Error(message);
  }

  return outcome.value;
}
