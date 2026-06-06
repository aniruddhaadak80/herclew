import { spawn, ChildProcessWithoutNullStreams } from "child_process";
import * as os from "os";

export class PTYServer {
  private shellProcess: ChildProcessWithoutNullStreams | null = null;

  public startShell(onData: (data: string) => void): void {
    const isWin = os.platform() === "win32";
    const shell = isWin ? "powershell.exe" : "bash";
    const args = isWin ? ["-NoExit", "-Command", "$OutputEncoding = [System.Text.Encoding]::UTF8"] : ["-i"];

    this.shellProcess = spawn(shell, args);

    this.shellProcess.stdout.on("data", (data) => {
      onData(data.toString("utf8"));
    });

    this.shellProcess.stderr.on("data", (data) => {
      onData(data.toString("utf8"));
    });

    this.shellProcess.on("close", (code) => {
      onData(`\r\n[Shell process exited with code ${code}]\r\n`);
      this.shellProcess = null;
    });
  }

  public writeInput(input: string): void {
    if (this.shellProcess && this.shellProcess.stdin) {
      this.shellProcess.stdin.write(input);
    }
  }

  public resizeTerminal(cols: number, rows: number): void {
    // Standard child_process.spawn does not support dynamic terminal resizing directly
    // but we log or route settings to conform with MCP/OpenHands standard interfaces.
    console.log(`Resizing terminal window to: ${cols}x${rows}`);
  }

  public killShell(): void {
    if (this.shellProcess) {
      this.shellProcess.kill("SIGTERM");
      this.shellProcess = null;
    }
  }
}
