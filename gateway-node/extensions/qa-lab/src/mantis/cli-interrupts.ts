import { formatErrorMessage } from "openclaw/plugin-sdk/error-runtime";

type MantisCliInterrupt = "SIGINT" | "SIGTERM" | "SIGHUP";

const INTERRUPT_EXIT_CODES: Record<MantisCliInterrupt, number> = {
  SIGINT: 130,
  SIGTERM: 143,
  SIGHUP: 129,
};

// Port of upstream runWithMantisCliInterrupts, trimmed to the fork: the
// upstream version talks to scripts/run-node.mts worktree cleanup and reads
// interrupted-run artifacts. The fork doesn't ship the Mantis runtimes yet,
// so interrupt handling is reduced to aborting + exit codes.
export async function runWithMantisCliInterrupts(
  run: (signal: AbortSignal) => Promise<void>,
): Promise<void> {
  const abortController = new AbortController();
  let interruptedBy: MantisCliInterrupt | undefined;
  const interrupt = (signal: MantisCliInterrupt) => {
    if (interruptedBy) {
      return;
    }
    interruptedBy = signal;
    abortController.abort(new Error(`Mantis interrupted by ${signal}`));
  };
  const onSigint = () => interrupt("SIGINT");
  const onSigterm = () => interrupt("SIGTERM");
  const onSighup = () => interrupt("SIGHUP");

  process.on("SIGINT", onSigint);
  process.on("SIGTERM", onSigterm);
  process.on("SIGHUP", onSighup);
  try {
    await run(abortController.signal);
  } catch (error) {
    if (!interruptedBy) {
      throw error;
    }
    process.stderr.write(`Mantis ${interruptedBy} interrupted: ${formatErrorMessage(error)}\n`);
  } finally {
    process.off("SIGINT", onSigint);
    process.off("SIGTERM", onSigterm);
    process.off("SIGHUP", onSighup);
    if (interruptedBy) {
      process.exitCode = INTERRUPT_EXIT_CODES[interruptedBy];
    }
  }
}
