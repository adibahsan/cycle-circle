/** Arguments forwarded to Playwright by `pnpm handbook:capture`: drop every bare `--` so both `<name>` and `-- <name>` filter. */
export function normalizeCaptureArgs(argv) {
  return argv.filter((a) => a !== '--')
}
