"""
SavingsVault Smart Contract
============================
A commitment device that locks user funds toward a savings goal and enforces
withdrawal conditions on-chain. Built with AlgoKit (algopy / ARC-4) as part
of the AlgoSave project.

Global State:
    goal_owner     (bytes)   — 32-byte address of the savings goal creator
    target_amount  (uint64)  — savings target in microALGOs
    total_saved    (uint64)  — running total of deposits in microALGOs
    deadline       (uint64)  — Unix timestamp after which withdrawal is always allowed
    goal_completed (uint64)  — 0 = active, 1 = goal reached

On-chain commitment logic:
    • Deposits are accepted only before the deadline and until the goal is met.
    • Withdrawal is gated: funds are only released when the goal is completed
      OR the deadline has passed.
    • No admin override — the contract owner (creator) cannot bypass these rules.
"""

from algopy import ARC4Contract, Asset, Global, GlobalState, Txn, UInt64, arc4, gtxn, itxn


class SavingsVault(ARC4Contract):
    """On-chain savings vault with enforced commitment logic."""

    # ── Global state ───────────────────────────────────────────────────────────

    goal_owner: GlobalState[arc4.Address]
    target_amount: GlobalState[UInt64]
    total_saved: GlobalState[UInt64]
    deadline: GlobalState[UInt64]
    goal_completed: GlobalState[UInt64]

    # ── Lifecycle ──────────────────────────────────────────────────────────────

    @arc4.abimethod(create="require")
    def create_goal(
        self,
        owner: arc4.Address,
        target: arc4.UInt64,
        deadline_ts: arc4.UInt64,
    ) -> None:
        """
        Initialise the vault.  Called exactly once at application creation.

        Args:
            owner:       Algorand address that owns this savings goal.
            target:      Savings target in microALGOs.
            deadline_ts: Unix timestamp after which funds are always withdrawable.
        """
        self.goal_owner = GlobalState(owner)
        self.target_amount = GlobalState(target.native)
        self.deadline = GlobalState(deadline_ts.native)
        self.total_saved = GlobalState(UInt64(0))
        self.goal_completed = GlobalState(UInt64(0))

    # ── Core methods ───────────────────────────────────────────────────────────

    @arc4.abimethod
    def deposit(self, payment: gtxn.PaymentTransaction) -> None:
        """
        Accept a deposit towards the savings goal.

        Must be submitted as a grouped transaction:
            [0] Payment txn — sender → contract address
            [1] This app call

        Commitment enforcement:
            • Only the goal owner may deposit.
            • Deposits are rejected after the deadline.
            • Deposits are rejected once the goal is already completed.
            • Payment receiver must be this contract's account.
        """
        assert Txn.sender == self.goal_owner.value.native, "Sender must be goal owner"
        assert Global.latest_timestamp < self.deadline.value, "Cannot deposit after deadline"
        assert self.goal_completed.value == UInt64(0), "Goal already completed"
        assert payment.receiver == Global.current_application_address, "Payment must go to contract"

        # Update running total.
        self.total_saved.value = self.total_saved.value + payment.amount

        # Check if target has been reached.
        if self.total_saved.value >= self.target_amount.value:
            self.goal_completed.value = UInt64(1)

    @arc4.abimethod
    def withdraw(self) -> None:
        """
        Withdraw the entire vault balance to the goal owner.

        Commitment enforcement:
            • Only the goal owner can call this.
            • Withdrawal is only permitted when the goal is completed
              OR the deadline has passed — the contract cannot be bypassed.
        """
        assert Txn.sender == self.goal_owner.value.native, "Only goal owner can withdraw"
        assert (
            self.goal_completed.value == UInt64(1)
            or Global.latest_timestamp >= self.deadline.value
        ), "Withdrawal conditions not met: goal incomplete and deadline not reached"

        # Inner transaction: send entire balance (including MBR) back to owner.
        itxn.Payment(
            receiver=self.goal_owner.value.native,
            amount=0,
            close_remainder_to=self.goal_owner.value.native,
            fee=0,
        ).submit()
