"""
contracts/compile.py
─────────────────────────────────────────────────────────────────────────────
Compiles the SavingsVault Beaker smart contract and writes the base64-encoded
TEAL programs to contracts/build/. It also prints the two lines you need to
paste into src/lib/blockchain.ts so the DApp can deploy contracts.

Usage (from the project root):
    # 1. Create and activate a virtual environment
    python -m venv .venv
    .venv\\Scripts\\activate          # Windows
    # source .venv/bin/activate       # macOS / Linux

    # 2. Install dependencies
    pip install -r contracts/requirements.txt

    # 3. Compile
    python contracts/compile.py
─────────────────────────────────────────────────────────────────────────────
"""

import base64
import json
import pathlib
import sys

# ---------------------------------------------------------------------------
# Make sure the project root is on the Python path so `from contracts.app`
# resolves correctly whether we run from the root or the contracts/ folder.
# ---------------------------------------------------------------------------
ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# ---------------------------------------------------------------------------
# Import and compile
# ---------------------------------------------------------------------------
try:
    from contracts.app import app   # noqa: E402
except ImportError as exc:
    sys.exit(
        f"ERROR: Could not import contracts/app.py.\n"
        f"       Make sure you have activated your venv and installed:\n"
        f"         pip install -r contracts/requirements.txt\n"
        f"Details: {exc}"
    )

print("Building SavingsVault application spec…")
spec = app.build()

# ---------------------------------------------------------------------------
# Write output files
# ---------------------------------------------------------------------------
build_dir = ROOT / "contracts" / "build"
build_dir.mkdir(parents=True, exist_ok=True)

approval_b64 = base64.b64encode(spec.approval_program).decode()
clear_b64    = base64.b64encode(spec.clear_program).decode()

(build_dir / "approval.b64").write_text(approval_b64)
(build_dir / "clear.b64").write_text(clear_b64)

# Also write the raw TEAL text for inspection
(build_dir / "approval.teal").write_text(spec.approval_program.decode() if isinstance(spec.approval_program, bytes) else "")
(build_dir / "clear.teal").write_text(spec.clear_program.decode() if isinstance(spec.clear_program, bytes) else "")

# Write ABI JSON for reference
abi_path = build_dir / "abi.json"
abi_path.write_text(json.dumps(spec.contract.dictify(), indent=2))

# ---------------------------------------------------------------------------
# Print instructions
# ---------------------------------------------------------------------------
print("\n✅  Compilation successful!\n")
print("─" * 70)
print("Paste these two lines into src/lib/blockchain.ts:\n")
print(f'const APPROVAL_B64 = "{approval_b64}";')
print(f'const CLEAR_B64    = "{clear_b64}";')
print("\n─" * 70)
print(f"\nFiles written to {build_dir}/:")
print("  approval.b64  – base64 approval program (paste into blockchain.ts)")
print("  clear.b64     – base64 clear-state program")
print("  approval.teal – human-readable TEAL source")
print("  clear.teal    – human-readable clear TEAL source")
print("  abi.json      – ARC-4 ABI contract descriptor")
