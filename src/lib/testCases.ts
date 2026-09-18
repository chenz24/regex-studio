import type { ExpectedCapture, TestAssertions, TestCase } from '../types/regex';

export const MAX_TEST_CASES = 1_000;
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const integer = (value: unknown): value is number =>
  Number.isSafeInteger(value) && (value as number) >= 0;
const only = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key));

function validCapture(value: unknown): value is ExpectedCapture {
  if (!record(value) || !only(value, ['index', 'name', 'value', 'start', 'end'])) return false;
  return (
    integer(value.index) &&
    value.index > 0 &&
    (value.name === null || typeof value.name === 'string') &&
    (value.value === null
      ? value.start === -1 && value.end === -1
      : typeof value.value === 'string' &&
        integer(value.start) &&
        integer(value.end) &&
        value.end >= value.start)
  );
}

export function validAssertions(value: unknown): value is TestAssertions {
  if (!record(value) || !only(value, ['count', 'texts', 'ranges', 'captures', 'replacement']))
    return false;
  return (
    (value.count === undefined || integer(value.count)) &&
    (value.texts === undefined ||
      (Array.isArray(value.texts) && value.texts.every((text) => typeof text === 'string'))) &&
    (value.ranges === undefined ||
      (Array.isArray(value.ranges) &&
        value.ranges.every(
          (range) =>
            Array.isArray(range) &&
            range.length === 2 &&
            integer(range[0]) &&
            integer(range[1]) &&
            range[1] >= range[0],
        ))) &&
    (value.captures === undefined ||
      (Array.isArray(value.captures) &&
        value.captures.every(
          (groups) =>
            Array.isArray(groups) &&
            groups.every(validCapture) &&
            new Set(groups.map((g) => g.index)).size === groups.length,
        ))) &&
    (value.replacement === undefined || typeof value.replacement === 'string')
  );
}

export function validTestCase(value: unknown): value is TestCase {
  return (
    record(value) &&
    only(value, ['id', 'label', 'input', 'expect', 'assertions']) &&
    typeof value.id === 'string' &&
    value.id.length > 0 &&
    typeof value.label === 'string' &&
    typeof value.input === 'string' &&
    (value.expect === 'match' || value.expect === 'noMatch') &&
    (value.assertions === undefined || validAssertions(value.assertions))
  );
}

export function validTestCases(value: unknown): value is TestCase[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_TEST_CASES &&
    value.every(validTestCase) &&
    new Set(value.map((test) => test.id)).size === value.length
  );
}

/** A test set deliberately excludes workspace settings; importing appends cases. */
export function encodeTestSet(cases: TestCase[]): string {
  return JSON.stringify({ format: 'regexstudio-tests', version: 1, cases }, null, 2);
}

export function decodeTestSet(json: string): TestCase[] | null {
  // Inputs and assertion snapshots have no byte limit in the editor. Apply
  // the same schema/count rules here so every valid export can be restored.
  try {
    const data = JSON.parse(json);
    if (
      !record(data) ||
      !only(data, ['format', 'version', 'cases']) ||
      data.format !== 'regexstudio-tests' ||
      data.version !== 1 ||
      !validTestCases(data.cases)
    )
      return null;
    return data.cases;
  } catch {
    return null;
  }
}
