# AlgoSave — Smart Contract Workspace

This directory contains the **AlgoKit-managed smart contract** for the AlgoSave application.

The `SavingsVault` contract is written in **Algorand Python (algopy)** and compiled to AVM bytecode using **puyapy**.

## Structure

```
alogkit-contracts/
├── .algokit.toml                         # Workspace config
└── projects/
    └── alogkit-contracts/
        ├── smart_contracts/
        │   └── savings_vault/
        │       ├── contract.py           # ARC-4 SavingsVault contract
        │       └── deploy_config.py      # Testnet deployment script
        └── README.md
```

## Getting Started

See [docs/algokit-deployment.md](../docs/algokit-deployment.md) for full build and deployment instructions.

```bash
# Install dependencies
cd projects/alogkit-contracts
poetry install

# Build contract artifacts
algokit project run build

# Deploy to Algorand Testnet
algokit project deploy testnet
```

## Deployed Contract

| Detail      | Value                                                            |
|-------------|------------------------------------------------------------------|
| App ID      | `755771019`                                                      |
| Network     | Algorand Testnet                                                 |
| Explorer    | https://testnet.explorer.perawallet.app/application/755771019  |
