import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

// A zero-width character inside a string literal makes a lookup key that looks right and never matches
// (T56: the retry-period key carried a word joiner, U+2060, and was never found in the configuration table).
const INVISIBLE = /[\u200B-\u200D\u2060\uFEFF]/;

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sources(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

describe('source hygiene', () => {
  it('has no invisible characters in any source file', () => {
    const found = sources(join(__dirname, '..')).flatMap((file) =>
      readFileSync(file, 'utf8')
        .split('\n')
        .flatMap((line, index) =>
          INVISIBLE.test(line) ? [`${file}:${index + 1}`] : [],
        ),
    );
    expect(found).toEqual([]);
  });
});
