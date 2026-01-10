export function assertNever(x: never): never {
  throw new Error(`Unexpected case: ${JSON.stringify(x)}`);
}

