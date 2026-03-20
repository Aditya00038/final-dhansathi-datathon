"""
Deployment configuration for the SavingsVault contract.

This script deploys a demo instance of the SavingsVault contract to the
configured Algorand network (Testnet when ALGOD_SERVER points to TestNet).
It creates a sample goal so the App ID can be noted for the frontend.
"""

import logging
import time

import algokit_utils

logger = logging.getLogger(__name__)


def deploy() -> None:
    from smart_contracts.artifacts.savings_vault.savings_vault_client import (
        CreateGoalArgs,
        SavingsVaultFactory,
    )

    algorand = algokit_utils.AlgorandClient.from_environment()
    deployer = algorand.account.from_environment("DEPLOYER")

    factory = algorand.client.get_typed_app_factory(
        SavingsVaultFactory, default_sender=deployer.address
    )

    # Deploy a demo savings vault — goal: 5 ALGO, deadline: 30 days from now.
    target_micro_algos = 5_000_000  # 5 ALGO in microALGOs
    deadline_ts = int(time.time()) + 30 * 24 * 60 * 60  # 30 days from now

    app_client, result = factory.deploy(
        on_update=algokit_utils.OnUpdate.AppendApp,
        on_schema_break=algokit_utils.OnSchemaBreak.AppendApp,
        create_args=algokit_utils.DeployCallArgs(
            args=CreateGoalArgs(
                owner=deployer.address,
                target=target_micro_algos,
                deadline_ts=deadline_ts,
            )
        ),
    )

    logger.info(
        f"SavingsVault deployed — App ID: {app_client.app_id} | "
        f"App Address: {app_client.app_address}"
    )

    # Fund the contract's minimum balance (0.1 ALGO).
    if result.operation_performed in [
        algokit_utils.OperationPerformed.Create,
        algokit_utils.OperationPerformed.Replace,
    ]:
        algorand.send.payment(
            algokit_utils.PaymentParams(
                amount=algokit_utils.AlgoAmount(algo=0.1),
                sender=deployer.address,
                receiver=app_client.app_address,
            )
        )
        logger.info("Funded contract minimum balance (0.1 ALGO).")

    logger.info(
        f"✅  SavingsVault is live!\n"
        f"    App ID  : {app_client.app_id}\n"
        f"    Explorer: https://testnet.explorer.perawallet.app/application/{app_client.app_id}"
    )
