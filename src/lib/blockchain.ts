import algosdk from "algosdk";
import { PeraWalletConnect } from "@perawallet/connect";
import type { Transaction } from "algosdk";
import type { OnChainGoal } from "./types";

// --- AlgoSDK Client Setup ---
const algodToken = ""; // No token needed for public TestNet node
const algodServer = "https://testnet-api.algonode.cloud";
const algodPort = 443;

export const algodClient = new algosdk.Algodv2(algodToken, algodServer, algodPort);

// --- Pera Wallet Setup ---
export const peraWallet = new PeraWalletConnect({
    chainId: 416002, // TestNet
});

// Reconnect to session when the component is mounted
export async function reconnectWalletSession() {
    return peraWallet.reconnectSession();
}

export async function disconnectWalletSession() {
    await peraWallet.disconnect();
}

// ---------------------------------------------------------------------------
// ABI Method Definitions for SavingsVault (mirrors contracts/app.py)
// Beaker generates ABI-encoded method calls. Each method selector is the
// first 4 bytes of the SHA-512/256 hash of its canonical signature string.
// algosdk.ABIMethod.getSelector() computes this for us correctly.
// ---------------------------------------------------------------------------

const createGoalMethod = new algosdk.ABIMethod({
    name: "create_goal",
    args: [
        { type: "address", name: "owner" },
        { type: "uint64",  name: "target" },
        { type: "uint64",  name: "deadline_ts" },
    ],
    returns: { type: "void" },
});

// deposit(pay)void — the payment txn is a "transaction argument" and must
// appear in the group IMMEDIATELY BEFORE the app-call txn (ARC-4 §2.3).
const depositMethod = new algosdk.ABIMethod({
    name: "deposit",
    args: [{ type: "pay", name: "payment" }],
    returns: { type: "void" },
});

const withdrawMethod = new algosdk.ABIMethod({
    name: "withdraw",
    args: [],
    returns: { type: "void" },
});

// ---------------------------------------------------------------------------
// Smart Contract Deployment
// ---------------------------------------------------------------------------
// The APPROVAL_PROGRAM and CLEAR_PROGRAM must be compiled from contracts/app.py
// using AlgoKit: run `algokit compile py contracts/app.py` then paste the
// resulting base64 strings below (or load from artifacts/).
//
// To compile:
//   pip install beaker-pyteal>=1.0.0 pyteal>=0.26.1
//   python -c "
//     from contracts.app import app
//     import base64, json, pathlib
//     spec = app.build()
//     pathlib.Path('contracts/build').mkdir(exist_ok=True)
//     pathlib.Path('contracts/build/approval.b64').write_text(
//       base64.b64encode(spec.approval_program).decode())
//     pathlib.Path('contracts/build/clear.b64').write_text(
//       base64.b64encode(spec.clear_program).decode())
//   "
// Then replace the empty strings below with the file contents.
const APPROVAL_B64 = "CCACAQAmBgpnb2FsX293bmVyC3RvdGFsX3NhdmVkDmdvYWxfY29tcGxldGVkCGRlYWRsaW5lBOSoxwANdGFyZ2V0X2Ftb3VudDEYIxJAACQ2GgAnBBJAACU2GgCABDYl5OsSQAAyNhoAgAS3NV/REkAAWQA2GgAnBBJEQgAAKDYaAWcnBTYaAhdnKzYaAxdnKSNnKiNnIkMxAChkEkQyBytkDEQqZCMSRDEWIgk4BzIKEkQpKWQxFiIJOAgIZylkJwVkD0EAAyoiZyJDMQAoZBJEKmQiEjIHK2QPEUSxIrIQKGSyByOyCCOyAShksgmzIkM=";
const CLEAR_B64    = "CIEB";

function loadProgram(b64: string): Uint8Array {
    if (!b64) return new Uint8Array(0);
    return new Uint8Array(Buffer.from(b64, "base64"));
}

const APPROVAL_PROGRAM = loadProgram(APPROVAL_B64);
const CLEAR_PROGRAM    = loadProgram(CLEAR_B64);

if (APPROVAL_PROGRAM.length === 0 || CLEAR_PROGRAM.length === 0) {
    console.warn(
        "⚠️  AlgoSave: Smart-contract TEAL programs are missing.\n" +
        "   Compile contracts/app.py and add the base64 output to\n" +
        "   APPROVAL_B64 / CLEAR_B64 in src/lib/blockchain.ts"
    );
}

export async function deployGoalContract(
    senderAddress: string,
    args: { targetAmount: number; deadline: Date },
    signTransactions: (txns: Transaction[]) => Promise<Uint8Array[]>
): Promise<number> {

    if (APPROVAL_PROGRAM.length === 0 || CLEAR_PROGRAM.length === 0) {
        throw new Error(
            "Smart contract TEAL code is missing. " +
            "Compile contracts/app.py and paste the base64 output into " +
            "APPROVAL_B64 / CLEAR_B64 in src/lib/blockchain.ts"
        );
    }

    const suggestedParams = await algodClient.getTransactionParams().do();

    // --- ABI-encode the create_goal arguments ---
    // Beaker 1.x routes the create transaction via the ABI method selector +
    // ABI-encoded arguments, so we must include them in appArgs.
    const selector = createGoalMethod.getSelector(); // Uint8Array[4]

    const addressType = new algosdk.ABIAddressType();
    const uint64Type  = new algosdk.ABIUintType(64);

    const encodedOwner    = addressType.encode(senderAddress);
    const encodedTarget   = uint64Type.encode(BigInt(Math.round(args.targetAmount * 1_000_000)));
    const encodedDeadline = uint64Type.encode(BigInt(Math.floor(args.deadline.getTime() / 1000)));

    const createTxn = algosdk.makeApplicationCreateTxnFromObject({
        from: senderAddress,
        suggestedParams,
        onComplete: algosdk.OnApplicationComplete.NoOpOC,
        approvalProgram: APPROVAL_PROGRAM,
        clearProgram: CLEAR_PROGRAM,
        numGlobalInts: 4,          // total_saved, target_amount, deadline, goal_completed
        numGlobalByteSlices: 1,    // goal_owner
        numLocalInts: 0,
        numLocalByteSlices: 0,
        appArgs: [selector, encodedOwner, encodedTarget, encodedDeadline],
    });

    const [signedCreate] = await signTransactions([createTxn]);
    const { txId: createTxId } = await algodClient.sendRawTransaction(signedCreate).do();
    const result = await algosdk.waitForConfirmation(algodClient, createTxId, 4);

    const appId: number = result["application-index"];
    if (!appId) throw new Error("Could not get App ID from deployment transaction.");

    // Fund the new contract account with its minimum balance requirement (0.1 ALGO).
    // This must be done AFTER deployment so we know the application address.
    const fundTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: senderAddress,
        to: algosdk.getApplicationAddress(appId),
        amount: 100_000, // 0.1 ALGO in microALGOs
        suggestedParams,
    });

    const [signedFund] = await signTransactions([fundTxn]);
    await algodClient.sendRawTransaction(signedFund).do();

    return appId;
}


// --- Smart Contract Interaction ---

export async function depositToGoal(
    appId: number,
    senderAddress: string,
    amount: number, // in ALGO
    signTransactions: (txns: Transaction[]) => Promise<Uint8Array[]>
): Promise<string> {
    const suggestedParams = await algodClient.getTransactionParams().do();

    // ARC-4 §2.3: transaction-type arguments must appear in the group
    // IMMEDIATELY BEFORE the app-call transaction.
    const paymentTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: senderAddress,
        to: algosdk.getApplicationAddress(appId),
        amount: Math.round(amount * 1_000_000), // ALGO → microALGO
        suggestedParams,
    });

    const appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
        from: senderAddress,
        suggestedParams,
        appIndex: appId,
        // Only the 4-byte ABI method selector; the payment txn is implicit.
        appArgs: [depositMethod.getSelector()],
    });

    // Group: [payment, appCall] — payment MUST precede the app call.
    algosdk.assignGroupID([paymentTxn, appCallTxn]);

    const signedTxns = await signTransactions([paymentTxn, appCallTxn]);
    const { txId } = await algodClient.sendRawTransaction(signedTxns).do();
    await algosdk.waitForConfirmation(algodClient, txId, 4);

    return txId;
}

export async function withdrawFromGoal(
    appId: number,
    senderAddress: string,
    signTransactions: (txns: Transaction[]) => Promise<Uint8Array[]>
): Promise<string> {
    const suggestedParams = await algodClient.getTransactionParams().do();
    // Cover the inner-transaction fee with an elevated outer fee.
    suggestedParams.fee = 2 * algosdk.ALGORAND_MIN_TX_FEE;
    suggestedParams.flatFee = true;

    const appCallTxn = algosdk.makeApplicationNoOpTxnFromObject({
        from: senderAddress,
        suggestedParams,
        appIndex: appId,
        appArgs: [withdrawMethod.getSelector()],
    });

    const [signedTxn] = await signTransactions([appCallTxn]);
    const { txId } = await algodClient.sendRawTransaction(signedTxn).do();
    await algosdk.waitForConfirmation(algodClient, txId, 4);
    return txId;
}

// --- State Reading ---

export async function getGoalOnChainState(appId: number): Promise<OnChainGoal> {
    if (appId === 0) { // Handle placeholder App ID for goals created before contract integration
        return {
            goalOwner: "",
            targetAmount: 0,
            totalSaved: 0,
            deadline: 0,
            goalCompleted: false,
            balance: 0,
        };
    }
    try {
        const appInfo = await algodClient.getApplicationByID(appId).do();
        const globalState = appInfo.params["global-state"];

        const state = globalState.reduce((acc: Record<string, any>, curr: any) => {
            const key = atob(curr.key);
            const value = curr.value;
            if (value.type === 1) { // byte slice
                 if (key === 'goal_owner') acc[key] = algosdk.encodeAddress(new Uint8Array(Buffer.from(value.bytes, 'base64')));
            } else { // uint
                acc[key] = value.uint;
            }
            return acc;
        }, {} as any);

        const accountInfo = await algodClient.accountInformation(algosdk.getApplicationAddress(appId)).do();
        const balance = accountInfo.amount;

        return {
            goalOwner: state.goal_owner,
            targetAmount: state.target_amount,
            totalSaved: state.total_saved,
            deadline: state.deadline,
            goalCompleted: state.goal_completed === 1,
            balance: balance,
        };
    } catch (error) {
        console.error(`Failed to get on-chain state for App ID ${appId}:`, error);
        throw new Error(`Could not fetch state for App ${appId}. It may not exist on TestNet.`);
    }
}

// ---------------------------------------------------------------------------
// ARC-3 Compliant Achievement NFT Minting
// ---------------------------------------------------------------------------
// Creates a unique Algorand Standard Asset (ASA) with:
//   - Total supply: 1  (non-fungible)
//   - Decimals: 0
//   - ARC-3 metadata embedded in the transaction note
// The returned object contains the ASA ID and the creation transaction ID.

export interface MintNFTResult {
    asaId: number;
    txId: string;
}

export async function mintAchievementNFT(
    senderAddress: string,
    goalInfo: {
        goalName: string;
        targetAmount: number; // microALGOs
        totalSaved: number;   // microALGOs
        appId: number;
    },
    signTransactions: (txns: Transaction[]) => Promise<Uint8Array[]>
): Promise<MintNFTResult> {
    const suggestedParams = await algodClient.getTransactionParams().do();

    // ARC-3 metadata stored in the transaction note field as JSON
    const arc3Metadata = {
        standard: "arc3",
        name: `DhanSathi Achievement: ${goalInfo.goalName}`,
        description: `Goal "${goalInfo.goalName}" completed on DhanSathi AlgoSave`,
        properties: {
            goalName: goalInfo.goalName,
            targetAmount: goalInfo.targetAmount,
            totalSaved: goalInfo.totalSaved,
            appId: goalInfo.appId,
            completedAt: new Date().toISOString(),
        },
    };

    const note = new TextEncoder().encode(JSON.stringify(arc3Metadata));

    // Algorand ASA name limit: 32 bytes. Prefix "DSAchv-" = 7 bytes, leaving 25 bytes.
    // Use substring(0, 8) which is at most 24 bytes even for 3-byte UTF-8 characters.
    const namePart = goalInfo.goalName.replace(/\s+/g, "").substring(0, 8);
    const assetName = `DSAchv-${namePart}`;
    const unitName = "DSACHV";

    // ARC-3 requires the asset URL to end with "#arc3" to signal that the
    // asset follows the ARC-3 metadata standard.
    // We embed the goal's AlgoExplorer link so verifiers can trace it back to
    // the savings vault contract on Algorand Testnet.
    const assetUrl = `https://testnet.explorer.perawallet.app/application/${goalInfo.appId}#arc3`;

    const createAsaTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
        from: senderAddress,
        suggestedParams,
        defaultFrozen: false,
        unitName,
        assetName,
        total: 1,
        decimals: 0,
        manager: senderAddress,
        reserve: senderAddress,
        freeze: senderAddress,
        clawback: senderAddress,
        assetURL: assetUrl,
        note,
    });

    const [signedTxn] = await signTransactions([createAsaTxn]);
    const { txId } = await algodClient.sendRawTransaction(signedTxn).do();
    const result = await algosdk.waitForConfirmation(algodClient, txId, 4);

    const asaId: number = result["asset-index"];
    if (!asaId) throw new Error("Could not get ASA ID from NFT creation transaction.");

    return { asaId, txId };
}
