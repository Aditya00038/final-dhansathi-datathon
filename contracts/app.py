from beaker import *
from pyteal import *

# This class defines the global state structure for our smart contract.
# Global state is stored on the blockchain and is accessible by anyone who can read the application's state.
# It's the single source of truth for the savings goal's parameters.
class SavingsVaultState:
    # goal_owner: The Algorand address of the user who created the goal.
    # This is crucial for access control, ensuring only the owner can withdraw.
    goal_owner = GlobalStateValue(
        stack_type=TealType.bytes,
        descr="The address of the person who owns the savings goal",
    )
    # target_amount: The total amount of microALGOs the user aims to save.
    target_amount = GlobalStateValue(
        stack_type=TealType.uint64,
        descr="The target amount to save in microALGOs",
    )
    # total_saved: The current amount of microALGOs saved in the contract.
    # This is updated with every valid deposit.
    total_saved = GlobalStateValue(
        stack_type=TealType.uint64,
        descr="The total amount saved so far in microALGOs",
    )
    # deadline: The Unix timestamp for when the savings goal expires.
    # After this time, the owner can withdraw funds regardless of whether the goal was met.
    deadline = GlobalStateValue(
        stack_type=TealType.uint64,
        descr="The deadline for the savings goal as a Unix timestamp",
    )
    # goal_completed: A flag (0 for false, 1 for true) indicating if the target_amount has been reached.
    # This provides a clear, on-chain signal of success.
    goal_completed = GlobalStateValue(
        stack_type=TealType.uint64, # Using uint64 for boolean (0 or 1)
        descr="Whether the goal has been completed or not",
    )

app = Application("SavingsVault", state=SavingsVaultState)

@app.create
def create_goal(owner: abi.Address, target: abi.Uint64, deadline_ts: abi.Uint64):
    """
    Initializes the smart contract's global state. This method is called only once, at application creation.
    It sets up the fundamental parameters of the savings vault.
    """
    return Seq(
        # Set the immutable parameters of the savings goal.
        app.state.goal_owner.set(owner.get()),
        app.state.target_amount.set(target.get()),
        app.state.deadline.set(deadline_ts.get()),
        # Initialize mutable state variables.
        app.state.total_saved.set(Int(0)),
        app.state.goal_completed.set(Int(0)), # 0 represents false
    )

@app.external
def deposit(payment: abi.PaymentTransaction):
    """
    Accepts a deposit towards the savings goal. This method must be called as part of a grouped transaction
    that includes a payment from the user to the smart contract address.
    The grouped transaction ensures atomicity: either both the app call and payment succeed, or both fail.
    """
    return Seq(
        # --- Validation Checks ---
        # These Assert statements enforce the rules of the savings goal. If any of these conditions
        # are false, the entire transaction group will fail, preventing invalid deposits.

        # 1. Sender must be the goal owner. This prevents unauthorized deposits.
        Assert(
            Txn.sender() == app.state.goal_owner.get(),
            comment="Sender must be the goal owner"
        ),
        # 2. The current time must be before the deadline.
        Assert(
            Global.latest_timestamp() < app.state.deadline.get(),
            comment="Cannot deposit after deadline"
        ),
        # 3. The goal must not already be completed.
        Assert(
            app.state.goal_completed.get() == Int(0),
            comment="Goal is already completed"
        ),
        # 4. The payment receiver must be this contract's address.
        Assert(
            payment.get().receiver() == Global.current_application_address(),
            comment="Payment receiver must be the contract address"
        ),

        # --- State Update ---
        # If all validations pass, update the total amount saved.
        app.state.total_saved.set(app.state.total_saved.get() + payment.get().amount()),

        # --- Goal Completion Check ---
        # Check if the new total saved meets or exceeds the target amount.
        If(app.state.total_saved.get() >= app.state.target_amount.get()).Then(
            # If the goal is met, set the on-chain completion flag.
            app.state.goal_completed.set(Int(1)) # 1 represents true
        ),
    )

@app.external
def withdraw(*, output: abi.Address):
    """
    Allows the owner to withdraw the entire balance of the contract.
    This enforces the savings discipline: funds are locked until conditions are met.
    """
    return Seq(
        # --- Validation Checks ---
        # 1. Only the original goal owner can initiate a withdrawal.
        Assert(
            Txn.sender() == app.state.goal_owner.get(),
            comment="Only goal owner can withdraw"
        ),
        # 2. Withdrawal is only permitted if either the goal is marked as completed OR the deadline has passed.
        # This is the core logic that enforces savings discipline.
        Assert(
            Or(
                app.state.goal_completed.get() == Int(1),
                Global.latest_timestamp() >= app.state.deadline.get()
            ),
            comment="Withdrawal conditions not met: goal not complete and deadline not passed"
        ),

        # --- Fund Transfer ---
        # Use an Inner Transaction to transfer the entire balance of the contract account
        # back to the goal owner. This also closes the contract account on the blockchain,
        # reclaiming the minimum balance.
        InnerTxnBuilder.Execute({
            TxnField.type_enum: TxnType.Payment,
            TxnField.receiver: app.state.goal_owner.get(),
            # Transfer the contract's balance, minus the minimum required balance, which will be reclaimed.
            TxnField.amount: Balance(Global.current_application_address()) - MinBalance(Global.current_application_address()),
            TxnField.fee: Int(0), # The fee for this inner transaction is paid by the outer transaction.
            # Close the contract account and send the remaining balance (MSR) to the owner.
            TxnField.close_remainder_to: app.state.goal_owner.get(),
        }),
        output.set(app.state.goal_owner.get())
    )

# --- Bare Application Calls for Housekeeping ---
# These allow for standard account interactions with the smart contract.
# In Beaker 1.x the bare=True flag on @app.external handles calls with no ABI encoding.

@app.external(close_out=CallConfig.CALL, bare=True)
def close_out():
    # Allows an account that has opted-in to close out their local state. Not used in this contract.
    return Approve()

# The clear-state program runs when the app is force-cleared from an account.
# Beaker 1.x exposes it via the application's clear_state property instead of
# a bare_external decorator. We handle it at the Application level by compiling
# the approval program with a simple Approve() for the clear path.
@app.external(clear_state=CallConfig.CALL, bare=True)
def clear_state_handler():
    # Handles the case where the contract is cleared from an account.
    return Approve()
