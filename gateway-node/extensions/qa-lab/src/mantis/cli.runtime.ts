import type {
  MantisBeforeAfterOptions,
  MantisDesktopBrowserSmokeOptions,
  MantisDiscordSmokeOptions,
  MantisSlackDesktopSmokeOptions,
  MantisTelegramDesktopBuilderOptions,
  MantisVisualDriverOptions,
  MantisVisualTaskOptions,
} from "./cli.js";

// The fork (herclew) ports the Mantis CLI registration but not the Mantis
// runtimes (run.runtime, desktop-browser-smoke.runtime, ...), so these
// commands fail with a clear error instead of "module not found". Tests
// mock this module entirely.
function unavailable(label: string): never {
  throw new Error(
    `${label}: Mantis runtimes are not ported to this fork; wire up the runtime implementation to enable this command.`,
  );
}

export async function runMantisDiscordSmokeCommand(_opts: MantisDiscordSmokeOptions) {
  unavailable("Mantis Discord smoke");
}

export async function runMantisBeforeAfterCommand(_opts: MantisBeforeAfterOptions) {
  unavailable("Mantis before/after");
}

export async function runMantisDesktopBrowserSmokeCommand(
  _opts: MantisDesktopBrowserSmokeOptions,
) {
  unavailable("Mantis desktop browser");
}

export async function runMantisSlackDesktopSmokeCommand(
  _opts: MantisSlackDesktopSmokeOptions,
) {
  unavailable("Mantis Slack desktop");
}

export async function runMantisTelegramDesktopBuilderCommand(
  _opts: MantisTelegramDesktopBuilderOptions,
) {
  unavailable("Mantis Telegram desktop builder");
}

export async function runMantisVisualTaskCommand(_opts: MantisVisualTaskOptions) {
  unavailable("Mantis visual task");
}

export async function runMantisVisualDriverCommand(_opts: MantisVisualDriverOptions) {
  unavailable("Mantis visual driver");
}
