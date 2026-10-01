/**
 * An input error: a file that cannot be read or parsed, the single-license Gradle shape, an invalid
 * overrides entry, or no input at all. The CLI turns it into exit code 3 (SCOPE.md, "Exit codes").
 * It is a separate class so that a genuine bug in the tool is not reported as the user's mistake.
 */
export class InputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InputError'
  }
}
