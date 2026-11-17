"""Test that skills subparser doesn't conflict (regression test for #898)."""

import argparse

# Collection-time snapshot: pytest imports every test module before running any
# test body, so this binds the ORIGINAL hermes_cli.main object here. The spec
# below re-imports that module; if it re-imports by deleting from sys.modules
# and leaves the copy registered, this identity no longer matches and the guard
# test fails. See the guard's docstring for why a split breaks other specs.
import hermes_cli.main as _original_main  # noqa: F401

_ORIGINAL_MAIN_ID = id(_original_main)


def test_no_duplicate_skills_subparser(monkeypatch):
    """Ensure 'skills' subparser is only registered once to avoid Python 3.11+ crash.

    Python 3.11 changed argparse to raise an exception on duplicate subparser
    names instead of silently overwriting (see CPython #94331).

    This test will fail with:
        argparse.ArgumentError: argument command: conflicting subparser: skills

    if the duplicate 'skills' registration is reintroduced.
    """
    # Force fresh import of the module where parser is constructed
    # If there are duplicate 'skills' subparsers, this import will raise
    # argparse.ArgumentError at module load time
    import sys

    # monkeypatch.delitem puts the ORIGINAL module object back at teardown. A
    # bare ``del sys.modules['hermes_cli.main']`` leaves the re-imported copy
    # registered, splitting hermes_cli.main into two module objects: later
    # specs in the same xdist worker that bound ``cmd_update`` /
    # ``_UpdateOutputStream`` at collection keep running the OLD object, while
    # string-form monkeypatch targets ("hermes_cli.main.X") resolve the NEW one
    # - the patch silently misses, so the code under test reads its real
    # module-level state instead of the stub. See test_env_loader.py.
    monkeypatch.delitem(sys.modules, "hermes_cli.main", raising=False)

    try:
        import hermes_cli.main  # noqa: F401
    except argparse.ArgumentError as e:
        if "conflicting subparser" in str(e):
            raise AssertionError(
                f"Duplicate subparser detected: {e}. See issue #898 for details."
            ) from e
        raise


def test_reimport_does_not_split_hermes_main():
    """The re-import above must not leave a second hermes_cli.main behind.

    Splitting the module silently breaks unrelated specs in the same xdist
    worker. There are 34 string-form patch sites
    (``monkeypatch.setattr("hermes_cli.main.X", ...)``) that resolve the module
    currently in ``sys.modules``, while a spec that imported a name at collection
    time keeps the OLD object - so the patch lands on a module the code under
    test never reads, and the stub appears to be ignored. The same split makes
    ``isinstance(x, SomeClass)`` return False for a class that has the right name
    but came from the other copy.
    """
    import sys

    after = sys.modules.get("hermes_cli.main")
    assert after is not None, "hermes_cli.main missing from sys.modules"
    assert after is _original_main and id(after) == _ORIGINAL_MAIN_ID, (
        "hermes_cli.main was split into two module objects: this file bound id "
        f"{_ORIGINAL_MAIN_ID} at collection, sys.modules now holds {id(after)}. "
        "Restore the original object at teardown (monkeypatch.delitem) instead "
        "of leaving a re-imported copy registered."
    )
