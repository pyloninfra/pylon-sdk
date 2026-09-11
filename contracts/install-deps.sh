#!/usr/bin/env bash
# Installs the pinned Foundry dependencies for this repo.
# contracts/lib is intentionally not committed (see .gitignore) — run this
# once after cloning, or any time lib/ is missing or out of date.
#
# Usage: cd contracts && ./install-deps.sh
set -euo pipefail

if ! git rev-parse --is-inside-work-tree &>/dev/null; then
  echo "Error: run this from inside a git repository (forge install needs one to add submodules)."
  exit 1
fi

deps=(
  "OpenZeppelin/openzeppelin-contracts@v5.5.0"
  "OpenZeppelin/openzeppelin-contracts-upgradeable@v5.5.0"
  "eth-infinitism/account-abstraction@v0.7.0"
  "foundry-rs/forge-std@v1.14.0"
)

for dep in "${deps[@]}"; do
  echo "Installing $dep ..."
  forge install "$dep"
done

echo "Done. Run 'forge build' next."
