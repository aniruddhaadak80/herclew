#!/usr/bin/env python3
"""Run each test file in its own freshly-spawned pytest subprocess, in parallel.

Why (this fork): CI used to run the whole suite as ONE xdist pool. Each xdist
worker is a long-lived process that runs hundreds of files back to back, so
module-level state leaks across files and failures move around with the worker
schedule. Three recurring leak classes:

* tests that ``del``/``pop`` entries from ``sys.modules`` without restoring the
  original object split the affected package into two module objects; a later
  string-form monkeypatch (``monkeypatch.setattr("pkg.mod.X", ...)``) then
  patches a different object than the one collection-time imports bound, so
  the stub is silently ignored (Nov 2026: ``hermes_cli.main`` splits broke
  ``tests/hermes_cli`` en masse - test_env_loader, test_skills_subparser),
* leaked threads / atexit handlers accumulate across thousands of tests until
  something deadlocks at session teardown (documented in pyproject.toml),
* plugin singletons, provider catalogs and ``os.environ`` mutations bleed
  between files.

Upstream NousResearch/hermes-agent solved this by running every test file in
its own subprocess (scripts/run_tests.sh + scripts/run_tests_parallel.py).
This script is that design, sized for this fork's 4-core CI runner:

* one ``python -m pytest <file>`` subprocess per test file - no shared state,
* bounded parallelism (``CI_TEST_WORKERS``, default ``os.cpu_count()``),
* per-file wall-clock timeout (``CI_TEST_FILE_TIMEOUT``, default 900s),
* exit code 5 ("no tests ran", e.g. every test is ``integration``) is a pass,
* failures are summarized with output tails at the end; exit 1 on any failure.

xdist inside a file is disabled (``-n 0``): parallelism comes from the file
pool, which is what keeps worker lifetimes short and leakage impossible.

Usage:
    python scripts/run_tests_parallel.py                  # full suite
    python scripts/run_tests_parallel.py tests/cli        # one directory
    python scripts/run_tests_parallel.py tests/a/test_x.py tests/b/test_y.py
"""

from __future__ import annotations

import concurrent.futures
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # core-agent/
WORKERS = int(os.environ.get("CI_TEST_WORKERS", "0")) or (os.cpu_count() or 2)
FILE_TIMEOUT = float(os.environ.get("CI_TEST_FILE_TIMEOUT", "900"))
TAIL_LINES = 200

sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def discover() -> list[Path]:
    """Every test_*.py under tests/, deterministically ordered."""
    return sorted(
        p for p in (ROOT / "tests").rglob("test_*.py") if "__pycache__" not in p.parts
    )


def expand(args: list[str]) -> list[Path]:
    """CLI args: files and/or directories; empty means the full suite."""
    if not args:
        return discover()
    out: list[Path] = []
    for a in args:
        p = Path(a).resolve()
        if p.is_dir():
            out.extend(
                q for q in sorted(p.rglob("test_*.py")) if "__pycache__" not in q.parts
            )
        elif p.is_file():
            out.append(p)
        else:
            sys.exit(f"error: no such file or directory: {a}")
    return out


def tail(text: str, n: int = TAIL_LINES) -> str:
    lines = text.splitlines()
    return "\n".join(lines[-n:])


def run_one(path: Path) -> tuple[Path, int, float, str]:
    """Run one test file in a fresh subprocess. Returns (path, rc, seconds, output)."""
    cmd = [
        sys.executable,
        "-m",
        "pytest",
        str(path.relative_to(ROOT)),
        "-n",
        "0",  # override pyproject addopts' -n auto: no xdist inside the file
        "-q",
        "--tb=short",
        # NOTE: no `-p no:cacheprovider` here - pytest's `-p <plugin>` collides
        # with hermes's inherited `-p/--profile` flag, which relaunch.py
        # extracts from sys.argv[1:] and forwards into the relaunched argv
        # (broke tests/hermes_cli/test_relaunch.py under this runner).
    ]
    env = dict(os.environ)
    env["PYTHONHASHSEED"] = "0"
    env["TZ"] = "UTC"
    t0 = time.monotonic()
    try:
        proc = subprocess.run(
            cmd,
            cwd=ROOT,
            timeout=FILE_TIMEOUT,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env,
        )
        rc, out = proc.returncode, proc.stdout or ""
    except subprocess.TimeoutExpired as e:
        out = e.stdout
        if isinstance(out, bytes):
            out = out.decode("utf-8", "replace")
        rc = 124
        if not out:
            out = f"(no output; killed after {FILE_TIMEOUT}s)"
    return path, rc, time.monotonic() - t0, out


def main() -> int:
    files = expand(sys.argv[1:])
    print(
        f"per-file test runner: {len(files)} files, "
        f"{WORKERS} workers, {FILE_TIMEOUT:.0f}s file timeout",
        flush=True,
    )

    failures: list[tuple[Path, int, str]] = []
    durations: list[tuple[float, Path]] = []
    n_pass = n_empty = 0
    t_start = time.monotonic()

    with tempfile.TemporaryDirectory(prefix="ci-test-logs-") as tmp:
        with concurrent.futures.ThreadPoolExecutor(max_workers=WORKERS) as pool:
            futures = {pool.submit(run_one, f): f for f in files}
            for fut in concurrent.futures.as_completed(futures):
                path, rc, dt, out = fut.result()
                durations.append((dt, path))
                if rc == 0:
                    n_pass += 1
                    print(f"PASS  {dt:6.1f}s  {path.relative_to(ROOT)}", flush=True)
                elif rc == 5:
                    n_empty += 1
                    print(f"EMPTY {dt:6.1f}s  {path.relative_to(ROOT)}", flush=True)
                else:
                    failures.append((path, rc, out))
                    log = (
                        Path(tmp)
                        / f"{path.relative_to(ROOT).as_posix().replace('/', '__')}.log"
                    )
                    log.write_text(out, encoding="utf-8", errors="replace")
                    print(
                        f"FAIL  {dt:6.1f}s  {path.relative_to(ROOT)}  (rc={rc}, full log: {log})",
                        flush=True,
                    )
                    print(
                        f"::error file=core-agent/{path.relative_to(ROOT).as_posix()}::test file FAILED (rc={rc})",
                        flush=True,
                    )

    wall = time.monotonic() - t_start
    print(
        f"\n=== summary: {len(files)} files | {n_pass} passed | {n_empty} empty | "
        f"{len(failures)} failed | wall {wall:.0f}s ===",
        flush=True,
    )

    if durations:
        print("\n=== slowest files ===", flush=True)
        for dt, path in sorted(durations, reverse=True)[:10]:
            print(f"  {dt:6.1f}s  {path.relative_to(ROOT)}", flush=True)

    for path, rc, out in failures:
        print(
            f"\n{'=' * 78}\n=== FAIL: {path.relative_to(ROOT)} (rc={rc}) - last {TAIL_LINES} lines ===\n{'=' * 78}",
            flush=True,
        )
        print(tail(out), flush=True)

    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
