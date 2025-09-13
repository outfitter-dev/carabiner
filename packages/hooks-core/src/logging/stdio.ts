/**
 * Lightweight stdio helpers to avoid direct console usage.
 *
 * - Use process.stdout/stderr directly to comply with strict noConsole rules.
 * - Keep API minimal and easy to mock in tests.
 */

export type Stdout = {
  write: (text: string) => void;
  line: (text: string) => void;
  json: (value: unknown) => void;
};

export type Stderr = {
  write: (text: string) => void;
  line: (text: string) => void;
};

export const stdout: Stdout = {
  write: (text: string) => {
    process.stdout.write(text);
  },
  line: (text: string) => {
    process.stdout.write(`${text}\n`);
  },
  json: (value: unknown) => {
    process.stdout.write(`${JSON.stringify(value)}\n`);
  },
};

export const stderr: Stderr = {
  write: (text: string) => {
    process.stderr.write(text);
  },
  line: (text: string) => {
    process.stderr.write(`${text}\n`);
  },
};
