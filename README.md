# DhanSathi — AI-Powered Financial Management on Algorand

DhanSathi is a personal finance management platform that combines AI-driven insights with on-chain savings discipline. Users connect their Algorand wallet, set savings goals that are enforced by a smart contract, track spending, and get personalised financial advice from a built-in AI advisor — all in one progressive web app.

---

## Hackathon Requirements & How We Fulfil Them

| Requirement | Status | Details |
|---|---|---|
| All smart contracts deployed to Algorand Testnet | ✅ | `SavingsVault` contract — App ID `755771019` |
| AlgoKit used as primary development framework | ✅ | AlgoKit workspace under `alogkit-contracts/`; built with `algokit project run build` |
| App ID (Testnet) provided at submission | ✅ | `755771019` — see [Testnet explorer link](#app-id-testnet--testnet-explorer) |
| Solution interacts with Algorand in a meaningful way | ✅ | Smart contract locks user funds, enforces goal deadlines, and releases them only when goals are met or the deadline passes — not just a payment layer |

---

## Problem Statement

Millions of people, especially in emerging markets, struggle with savings discipline. Traditional banks provide no programmable enforcement, and DeFi tools are too complex. DhanSathi addresses this by:

- Locking savings in an Algorand smart contract so they cannot be withdrawn until a goal is met or a deadline passes.
- Providing AI-generated financial advice tailored to the user's spending patterns.
- Supporting multilingual access (Google Translate integration) to reach underserved communities.

---

## Live Demo

> **URL:** [https://final-pw-proto.vercel.app](https://final-pw-proto.vercel.app)  
> *(Connect a Pera Wallet on Testnet to experience the full flow)*

---

## LinkedIn Demo Video

> **Video:** [Add your LinkedIn video URL here]

---

## App ID (Testnet) & Testnet Explorer

| Detail | Value |
|---|---|
| **App ID** | `755771019` |
| **Network** | Algorand Testnet |
| **Explorer** | [View on Pera Explorer](https://testnet.explorer.perawallet.app/application/755771019) |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     User (Browser)                      │
│              Next.js 15 Progressive Web App             │
└────────────────────────┬────────────────────────────────┘
                         │  algosdk + @algorandfoundation/algokit-utils
          ┌──────────────┴───────────────┐
          │                              │
          ▼                              ▼
 ┌─────────────────┐           ┌──────────────────┐
 │  Algorand Node  │           │  Firebase / AI   │
 │  (Testnet via   │           │  (Firestore for  │
 │   AlgoNode)     │           │   user data +    │
 │                 │           │   Genkit/Gemini  │
 │  SavingsVault   │           │   AI advisor)    │
 │  App ID:        │           └──────────────────┘
 │  755771019      │
 └─────────────────┘

Smart Contract Interaction Flow
────────────────────────────────
1. User connects Pera Wallet (WalletContext)
2. Frontend calls `create_goal(owner, target, deadline)` → deploys or calls contract
3. User deposits ALGOs via grouped atomic transaction (app call + payment)
4. Contract validates sender, deadline, and completion state; updates `total_saved`
5. When goal is met OR deadline passes, user calls `withdraw()` → inner transaction
   sends full balance back to owner
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract Framework | **AlgoKit** (workspace + deploy) |
| Smart Contract Language | **Algorand Python (algopy / puyapy)** for the AlgoKit contract; **PyTEAL + Beaker** for the legacy `contracts/app.py` |
| Blockchain | Algorand Testnet |
| Frontend | **Next.js 15** (App Router, TypeScript) |
| Wallet | **Pera Wallet** via `@perawallet/connect` |
| Blockchain SDK | `algosdk` 2.8, `@algorandfoundation/algokit-utils` |
| AI / LLM | **Google Genkit + Gemini** (AI financial advisor) |
| Database | **Firebase Firestore** (user goals, transactions, groups) |
| Styling | Tailwind CSS, shadcn/ui, Radix UI |
| Deployment | Vercel |

---

## Installation & Setup

### Prerequisites

- Node.js 20+
- Python 3.12+
- [AlgoKit CLI](https://github.com/algorandfoundation/algokit-cli#install) (`algokit --version` ≥ 2.0.0)
- [Poetry](https://python-poetry.org/docs/#installation) (`poetry -V` ≥ 1.2)
- [Pera Wallet](https://perawallet.app/) browser extension or mobile app (set to **Testnet**)

### 1. Clone the Repository

```bash
git clone https://github.com/AadityaHande/FInal-PW-Proto.git
cd FInal-PW-Proto
```

### 2. Install Frontend Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
NEXT_PUBLIC_ALGOD_SERVER=https://testnet-api.algonode.cloud
NEXT_PUBLIC_ALGOD_PORT=443
NEXT_PUBLIC_ALGOD_TOKEN=
NEXT_PUBLIC_APP_ID=755771019

# Firebase config
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id

# Genkit / Gemini AI
GOOGLE_GENAI_API_KEY=your_google_genai_key
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:9002](http://localhost:9002) in your browser.

### 5. (Optional) Build & Deploy the Smart Contract

```bash
cd alogkit-contracts/projects/alogkit-contracts
poetry install
algokit project run build
algokit project deploy testnet
```

---

## Usage Guide

### Connect Wallet
1. Open the app and click **Connect Wallet**.
2. Select **Pera Wallet** and approve the connection (ensure Testnet is active).

### Create a Savings Goal
1. Navigate to **Goals → New Goal**.
2. Enter a goal name, target amount (in ALGO), and deadline.
3. Confirm the transaction in Pera Wallet — this calls `create_goal` on the smart contract.

### Deposit
1. Open an existing goal and click **Deposit**.
2. Enter an amount and confirm the grouped atomic transaction (app call + payment).
3. The contract validates all conditions and updates `total_saved` on-chain.

### Withdraw
1. Once the goal is complete or the deadline has passed, click **Withdraw**.
2. The contract executes an inner transaction to return all funds to your wallet.

### AI Advisor
- Navigate to **Advisor** for personalised financial tips based on your spending patterns.

### Analytics & Leaderboard
- View spending breakdowns in **Analytics** and compare saving streaks in **Leaderboard**.

---

## Known Limitations

- Wallet support is currently limited to **Pera Wallet** only (no WalletConnect v2 / other wallets).
- The legacy `contracts/app.py` (PyTEAL + Beaker) is retained for reference; the production contract uses the AlgoKit workspace.
- Firebase Firestore rules are in development mode — production deployment requires proper security rules.
- The AI advisor requires a valid Google Genkit / Gemini API key; without it, the advisor tab will not function.
- Only **ALGO** is supported as the savings asset; ASA (Algorand Standard Asset) goals are not yet implemented.
- Mobile PWA install is supported on Android; iOS has limited PWA support.

---

## Team Members & Roles

| Name | Role |
|---|---|
| Aaditya Hande | Full-Stack Development, Smart Contract, AlgoKit Integration |

> *Add additional team members and their roles here.*

---

## Repository Structure

```
FInal-PW-Proto/
├── alogkit-contracts/          # AlgoKit smart contract workspace
│   └── projects/alogkit-contracts/
│       └── smart_contracts/savings_vault/
│           ├── contract.py     # ARC-4 SavingsVault (Algorand Python)
│           └── deploy_config.py
├── contracts/                  # Legacy PyTEAL + Beaker contract (reference)
│   └── app.py
├── src/
│   ├── app/                    # Next.js App Router pages
│   ├── components/             # React UI components
│   ├── contexts/               # WalletContext (Pera Wallet integration)
│   ├── hooks/                  # Custom React hooks
│   ├── lib/                    # algosdk helpers, Firebase client
│   └── ai/                     # Genkit AI flows
├── public/                     # Static assets
└── README.md
```
