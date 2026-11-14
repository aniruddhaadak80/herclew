"""Canonical platform-library mocks for gateway / e2e tests.

Both ``tests/gateway/conftest.py`` and ``tests/e2e/conftest.py`` need a
``telegram`` / ``discord`` module present in :data:`sys.modules` before
``gateway.platforms.*`` is imported (the adapters degrade to
``discord = None`` when the import fails, and the Discord UI view classes
are baked against whatever ``discord.ui.View`` resolved at import time).

Conftest import order across test directories is NOT guaranteed: in a
full-suite run ``tests/e2e/conftest.py`` is imported before
``tests/gateway/conftest.py`` (alphabetical collection), so whichever
conftest installs its stub first wins. Both must therefore share ONE
canonical installer:

* Robust real-library detection. ``hasattr(mod, "__file__")`` alone is
  not enough — a MagicMock auto-creates attributes, so a mock stub from
  another conftest passes the check and the comprehensive mock never
  installs, leaving every later test in the xdist worker with a bare
  stub (no ``ui.View``, no ``ChatType``, no ``AllowedMentions``).
* Augment-in-place. When a mock is already installed, the canonical
  installer sets all of its attributes on the existing object instead of
  replacing it — test modules and adapters may already hold references.
* Superset attributes. The mock covers every member any consumer needs
  (gateway tests AND tests/e2e), so either conftest can run first.
"""

import enum
import sys
import types
from types import SimpleNamespace
from unittest.mock import MagicMock


def _is_real_library_module(mod) -> bool:
    """True only for a genuinely imported library module."""
    return isinstance(mod, types.ModuleType) and hasattr(mod, "__file__")


def ensure_telegram_mock() -> None:
    """Install (or augment) the canonical ``telegram`` mock in sys.modules.

    Idempotent — a no-op when the real library is already imported, and
    an in-place augmentation when a mock is already present.

    Structurally correct: ``from telegram.constants import ChatType`` in
    ``gateway/platforms/telegram.py`` resolves against the object
    registered in ``sys.modules["telegram.constants"]`` — NOT against
    ``telegram.constants`` attribute access on the top-level mock. The
    submodules are therefore dedicated objects with real values, both
    registered in sys.modules and attached as attributes of the parent.
    The binding happens ONCE at first import (module globals), so a
    later test fixture that swaps sys.modules entries cannot repair an
    adapter module whose ``ChatType`` global is already a MagicMock
    auto-attribute — the mock must be right at first import.
    """
    existing = sys.modules.get("telegram")
    if existing is not None and _is_real_library_module(existing):
        return  # Real library is installed — nothing to mock

    # Real str-mixin enums so ``repr(ParseMode.MARKDOWN_V2)`` contains the
    # member name (some tests assert on the repr — with a plain
    # SimpleNamespace the repr is just the value string) while equality
    # against plain strings still works.
    class _FakeParseMode(str, enum.Enum):
        MARKDOWN = "Markdown"
        MARKDOWN_V2 = "MarkdownV2"
        HTML = "HTML"

    class _FakeChatType(str, enum.Enum):
        PRIVATE = "private"
        GROUP = "group"
        SUPERGROUP = "supergroup"
        CHANNEL = "channel"

    constants_mod = SimpleNamespace(
        ParseMode=_FakeParseMode,
        ChatType=_FakeChatType,
    )
    # filters needs ``&`` / ``~`` composition (filters.TEXT & ~filters.COMMAND).
    # Handler classes are MagicMock INSTANCES, not the MagicMock class:
    # production calls them with positional args
    # (``MessageHandler(filters.TEXT & ~filters.COMMAND, callback)``) and
    # MagicMock.__init__ would interpret the first positional as ``spec``
    # ("Cannot spec a Mock object" when it is itself a mock). Calling an
    # instance just returns a child mock and records the call.
    ext_mod = SimpleNamespace(
        Application=MagicMock(),
        CommandHandler=MagicMock(),
        CallbackQueryHandler=MagicMock(),
        MessageHandler=MagicMock(),
        ContextTypes=SimpleNamespace(DEFAULT_TYPE=object),
        filters=MagicMock(),
    )
    request_mod = SimpleNamespace(HTTPXRequest=MagicMock)
    # Real exception classes so ``except (NetworkError, ...)`` clauses
    # in production code don't blow up with TypeError.
    error_mod = SimpleNamespace(
        NetworkError=type("NetworkError", (OSError,), {}),
        TimedOut=type("TimedOut", (OSError,), {}),
        BadRequest=type("BadRequest", (Exception,), {}),
        Forbidden=type("Forbidden", (Exception,), {}),
        InvalidToken=type("InvalidToken", (Exception,), {}),
        RetryAfter=type("RetryAfter", (Exception,), {"retry_after": 1}),
        Conflict=type("Conflict", (Exception,), {}),
    )

    mod = existing if isinstance(existing, MagicMock) else MagicMock()
    mod.Update = MagicMock()
    mod.Update.ALL_TYPES = []
    mod.Bot = MagicMock
    mod.Message = MagicMock

    # PTB types that production code instantiates with POSITIONAL args
    # (``InlineKeyboardMarkup(rows)``). ``MagicMock(rows)`` treats the list
    # as ``spec`` and mock internals hash it -> "unhashable type: 'list'".
    # Real permissive classes keep the constructor contract.
    class _FakeInlineKeyboardButton:
        def __init__(self, text, callback_data=None, **kwargs):
            self.text = text
            self.callback_data = callback_data
            for key, value in kwargs.items():
                setattr(self, key, value)

    class _FakeInlineKeyboardMarkup:
        def __init__(self, inline_keyboard):
            self.inline_keyboard = inline_keyboard

    class _FakeLinkPreviewOptions:
        def __init__(self, **kwargs):
            for key, value in kwargs.items():
                setattr(self, key, value)

    mod.InlineKeyboardButton = _FakeInlineKeyboardButton
    mod.InlineKeyboardMarkup = _FakeInlineKeyboardMarkup
    mod.LinkPreviewOptions = _FakeLinkPreviewOptions
    mod.constants = constants_mod
    mod.ext = ext_mod
    mod.request = request_mod
    mod.error = error_mod

    def _install(name: str, value) -> None:
        entry = sys.modules.get(name)
        if entry is None or not _is_real_library_module(entry):
            sys.modules[name] = value

    _install("telegram", mod)
    _install("telegram.constants", constants_mod)
    _install("telegram.ext", ext_mod)
    _install("telegram.ext.filters", ext_mod.filters)
    _install("telegram.request", request_mod)
    _install("telegram.error", error_mod)


def ensure_discord_mock() -> None:
    """Install (or augment) the canonical ``discord`` mock in sys.modules.

    Comprehensive — includes **all** attributes needed by every gateway
    and tests/e2e discord test file.  Individual test files may still
    force-set their own specifics (e.g. ``AllowedMentions``) on top.
    """
    existing = sys.modules.get("discord")
    if existing is not None and _is_real_library_module(existing):
        return  # Real library is installed — nothing to mock

    discord_mod = existing if isinstance(existing, MagicMock) else MagicMock()
    discord_mod.Intents.default.return_value = MagicMock()
    discord_mod.Client = MagicMock
    discord_mod.File = MagicMock
    discord_mod.DMChannel = type("DMChannel", (), {})
    discord_mod.Thread = type("Thread", (), {})
    discord_mod.ForumChannel = type("ForumChannel", (), {})
    discord_mod.Interaction = object
    discord_mod.Message = type("Message", (), {})

    # Superset: attributes tests/e2e/conftest.py's stub also provides, so
    # either conftest can be imported first without the other's tests
    # losing needed members. MessageType mirrors the real enum member names
    # the system-message filter tests reference.
    discord_mod.Forbidden = type("Forbidden", (Exception,), {})
    discord_mod.MessageType = SimpleNamespace(
        default=0,
        reply=19,
        recipient_add=2,
        recipient_remove=3,
        channel_name_change=5,
        channel_follow_add=7,
        pins_add=6,
        new_member=8,
        premium_guild_subscription=9,
        thread_created=18,
        thread_starter_message=21,
        guild_incident_alert=31,
        guild_incident_warning_raid=32,
        guild_incident_warning_nuke=33,
    )
    discord_mod.Object = lambda *, id: SimpleNamespace(id=id)
    discord_mod.opus.is_loaded.return_value = True

    # Embed: accept the kwargs production code / tests use
    # (title, description, color). MagicMock auto-attributes work too,
    # but some tests construct and inspect .title/.description directly.
    class _FakeEmbed:
        def __init__(self, *, title=None, description=None, color=None, **_):
            self.title = title
            self.description = description
            self.color = color
            self.fields = []
            self.footer = None

        def add_field(self, *, name=None, value=None, inline=False, **_):
            self.fields.append({"name": name, "value": value, "inline": inline})
            return self

        def set_footer(self, *, text=None, icon_url=None, **_):
            self.footer = {"text": text, "icon_url": icon_url}
            return self

    discord_mod.Embed = _FakeEmbed

    # ui.View / ui.Select / ui.Button: real classes (not MagicMock) so
    # tests that subclass ModelPickerView / iterate .children / clear
    # items work.
    class _FakeView:
        def __init__(self, timeout=None):
            self.timeout = timeout
            self.children = []

        def add_item(self, item):
            self.children.append(item)

        def clear_items(self):
            self.children.clear()

    class _FakeSelect:
        def __init__(self, *, placeholder=None, options=None, custom_id=None, **_):
            self.placeholder = placeholder
            self.options = options or []
            self.custom_id = custom_id
            self.callback = None
            self.disabled = False

    class _FakeButton:
        def __init__(
            self,
            *,
            label=None,
            style=None,
            custom_id=None,
            emoji=None,
            url=None,
            disabled=False,
            row=None,
            sku_id=None,
            **_,
        ):
            self.label = label
            self.style = style
            self.custom_id = custom_id
            self.emoji = emoji
            self.url = url
            self.disabled = disabled
            self.row = row
            self.sku_id = sku_id
            self.callback = None

    class _FakeSelectOption:
        def __init__(self, *, label=None, value=None, description=None, **_):
            self.label = label
            self.value = value
            self.description = description

    discord_mod.SelectOption = _FakeSelectOption

    discord_mod.ui = SimpleNamespace(
        View=_FakeView,
        Select=_FakeSelect,
        Button=_FakeButton,
        button=lambda *a, **k: lambda fn: fn,
    )
    discord_mod.ButtonStyle = SimpleNamespace(
        success=1,
        primary=2,
        secondary=2,
        danger=3,
        green=1,
        grey=2,
        blurple=2,
        red=3,
    )
    discord_mod.Color = SimpleNamespace(
        orange=lambda: 1,
        green=lambda: 2,
        blue=lambda: 3,
        red=lambda: 4,
        purple=lambda: 5,
        greyple=lambda: 6,
    )

    # app_commands — needed by _register_slash_commands auto-registration
    class _FakeGroup:
        def __init__(self, *, name, description, parent=None):
            self.name = name
            self.description = description
            self.parent = parent
            self._children: dict = {}
            if parent is not None:
                parent.add_command(self)

        def add_command(self, cmd):
            self._children[cmd.name] = cmd

    class _FakeCommand:
        def __init__(self, *, name, description, callback, parent=None):
            self.name = name
            self.description = description
            self.callback = callback
            self.parent = parent

    discord_mod.app_commands = SimpleNamespace(
        describe=lambda **kwargs: lambda fn: fn,
        choices=lambda **kwargs: lambda fn: fn,
        autocomplete=lambda **kwargs: lambda fn: fn,
        Choice=lambda **kwargs: SimpleNamespace(**kwargs),
        Group=_FakeGroup,
        Command=_FakeCommand,
    )

    ext_mod = MagicMock()
    commands_mod = MagicMock()
    commands_mod.Bot = MagicMock
    ext_mod.commands = commands_mod

    for name in ("discord", "discord.ext", "discord.ext.commands"):
        entry = sys.modules.get(name)
        if entry is None or not _is_real_library_module(entry):
            sys.modules[name] = discord_mod
    entry = sys.modules.get("discord.ext")
    if entry is None or not _is_real_library_module(entry):
        sys.modules["discord.ext"] = ext_mod
    entry = sys.modules.get("discord.ext.commands")
    if entry is None or not _is_real_library_module(entry):
        sys.modules["discord.ext.commands"] = commands_mod
    entry = sys.modules.get("discord.opus")
    if entry is None or not _is_real_library_module(entry):
        sys.modules["discord.opus"] = discord_mod.opus
