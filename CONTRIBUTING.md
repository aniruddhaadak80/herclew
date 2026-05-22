# Contributing to Herclew ☤

Thank you for your interest in contributing to Herclew! Herclew is a unified hybrid monorepo merging a self-improving reasoning engine (Python) and a multi-channel messaging gateway (TypeScript).

---

## 🏛️ Monorepo Structure

Herclew is structured as a decoupled monorepo:
* **`core-agent/`**: Python-based self-improving reasoning engine. Exposes the `herclew` CLI.
* **`gateway-node/`**: Node.js/TypeScript messaging gateway (routes Discord, WhatsApp, Telegram, etc.). Exposes the `herclew-gateway` CLI.

---

## 🛠️ Local Development Setup

### Prerequisites
* **Node.js** >= 22 (recommended Node 24)
* **pnpm** >= 10.0
* **Python** >= 3.11 (recommended Python 3.13)
* **uv** (high-performance Python package installer)

---

### Setting Up the Python Core Agent (`core-agent/`)

1. Navigate to the agent directory:
   ```bash
   cd core-agent
   ```

2. Create a virtual environment using `uv`:
   ```bash
   uv venv
   # Activate it:
   # On Windows (PowerShell):
   .venv\Scripts\Activate.ps1
   # On macOS/Linux:
   source .venv/bin/activate
   ```

3. Install dependencies in editable mode:
   ```bash
   uv pip install -e ".[all]"
   ```

4. Verify it works:
   ```bash
   herclew --help
   ```

---

### Setting Up the TypeScript Gateway (`gateway-node/`)

1. Navigate to the gateway directory:
   ```bash
   cd gateway-node
   ```

2. Install dependencies via `pnpm`:
   ```bash
   pnpm install
   ```

3. Build the TypeScript source:
   ```bash
   pnpm build
   ```

4. Run the setup wizard to connect a message channel:
   ```bash
   pnpm herclew-gateway setup
   ```

---

## 🧪 Testing Guidelines

Before submitting a Pull Request, please ensure all automated tests pass.

### Python Core Agent Tests
Run tests inside `core-agent/` with `pytest`:
```bash
cd core-agent
pytest tests/
```

We also enforce code quality via `ruff`:
```bash
ruff check .
```

### TypeScript Gateway Tests
Run tests inside `gateway-node/` using `vitest`:
```bash
cd gateway-node
pnpm test
```

For linting and formatting:
```bash
pnpm lint
pnpm format
```

---

## 📥 Pull Request Guidelines

1. **Create a Branch**: Create a feature branch with a descriptive name, e.g., `feature/voice-channel` or `fix/rpc-buffer`.
2. **Write Clean Code**: Follow existing conventions, keep functions cohesive, and preserve all unrelated docstrings/comments.
3. **Write Tests**: Provide unit/integration tests for your changes.
4. **Update Docs**: If you change configuration parameters or add a new command/integration, update the relevant `README.md` or `docs/` files.
5. **Verify CI**: Ensure that your PR passes all checks in the GitHub Actions workflows (`core-agent-ci.yml` and `gateway-ci.yml`).

We appreciate your contributions to making Herclew the ultimate AI messaging agent!
