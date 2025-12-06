#!/usr/bin/env python3
"""
Deploy Wallet Risk Oracle contract to Neo N3 Testnet

Usage:
    python deploy.py --wif YOUR_WIF_KEY
    
Or set environment variable:
    export NEO_WIF=YOUR_WIF_KEY
    python deploy.py
"""

import argparse
import asyncio
import json
import os
import sys

from neo3.api.wrappers import ChainFacade, NeoToken, GasToken
from neo3.api.helpers.signing import sign_with_account
from neo3.wallet.account import Account
from neo3.network.payloads.verification import Signer
from neo3.core.types import UInt160
from neo3.contracts.nef import NEF
from neo3.contracts.manifest import ContractManifest


# Neo N3 Testnet RPC
TESTNET_RPC = "https://testnet1.neo.coz.io:443"

# Contract files
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
NEF_PATH = os.path.join(SCRIPT_DIR, "wallet_risk_oracle.nef")
MANIFEST_PATH = os.path.join(SCRIPT_DIR, "wallet_risk_oracle.manifest.json")


async def get_balance(facade: ChainFacade, account: Account) -> tuple[float, float]:
    """Get NEO and GAS balance for an address."""
    neo = NeoToken()
    gas = GasToken()
    
    neo_result = await facade.test_invoke(neo.balance_of(account.script_hash))
    gas_result = await facade.test_invoke(gas.balance_of(account.script_hash))
    
    neo_balance = neo_result.result if hasattr(neo_result, 'result') else int(neo_result)
    gas_balance = gas_result.result if hasattr(gas_result, 'result') else int(gas_result)
    
    return neo_balance, gas_balance / 100000000


async def deploy_contract(wif: str):
    """Deploy the wallet risk oracle contract."""
    
    # Load account from WIF
    account = Account.from_wif(wif)
    print(f"Deploying from address: {account.address}")
    print(f"Script hash: {account.script_hash}")
    
    # Connect to testnet
    facade = ChainFacade.node_provider_testnet()
    print(f"Connected to Neo N3 Testnet")
    
    # Check balance
    neo_bal, gas_bal = await get_balance(facade, account)
    print(f"Balance: {neo_bal} NEO, {gas_bal:.4f} GAS")
    
    if gas_bal < 10:
        print("ERROR: Need at least 10 GAS to deploy contract")
        print("Get testnet GAS from: https://neowish.ngd.network/")
        return None
    
    # Load contract files
    print("\nLoading contract files...")
    
    with open(NEF_PATH, 'rb') as f:
        nef_data = f.read()
    nef = NEF.deserialize_from_bytes(nef_data)
    
    with open(MANIFEST_PATH, 'r') as f:
        manifest_dict = json.load(f)
    manifest = ContractManifest.from_json(manifest_dict)
    
    print(f"Contract: {manifest.name}")
    print(f"Methods: {len(manifest.abi.methods)}")
    
    # Deploy using ContractManagement
    print("\nDeploying contract...")
    
    from neo3.api.wrappers import GenericContract
    
    # ContractManagement hash on Neo N3
    contract_management_hash = UInt160.from_string("0xfffdc93764dbaddd97c48f252a53ea4643faa3fd")
    
    contract_mgmt = GenericContract(contract_management_hash)
    
    # Build deployment call
    deploy_call = contract_mgmt.call_function(
        "deploy",
        [nef_data, json.dumps(manifest_dict).encode()]
    )
    
    # Add signer
    facade.add_signer(
        sign_with_account(account),
        Signer(account.script_hash)
    )
    
    # Invoke
    result = await facade.invoke(deploy_call)
    
    print(f"\nTransaction: {result}")
    print("\nWaiting for confirmation...")
    
    # Wait for transaction
    await asyncio.sleep(15)
    
    # Calculate contract hash from NEF script (hash160 = ripemd160(sha256(script)))
    import hashlib
    script_sha256 = hashlib.sha256(nef.script).digest()
    contract_hash = hashlib.new('ripemd160', script_sha256).digest()
    
    print(f"\nContract deployed!")
    # Neo uses little-endian for display
    print(f"Contract hash: 0x{contract_hash[::-1].hex()}")
    
    return contract_hash


async def main():
    parser = argparse.ArgumentParser(description="Deploy Wallet Risk Oracle to Neo N3 Testnet")
    parser.add_argument("--wif", help="WIF private key", default=os.environ.get("NEO_WIF"))
    parser.add_argument("--create-wallet", action="store_true", help="Create a new wallet")
    args = parser.parse_args()
    
    if args.create_wallet:
        account = Account()
        print("New wallet created!")
        print(f"Address: {account.address}")
        print(f"Script hash: {account.script_hash}")
        wif = Account.private_key_to_wif(account.private_key)
        print(f"WIF: {wif}")
        print("\nGet testnet GAS from: https://neowish.ngd.network/")
        return
    
    if not args.wif:
        print("ERROR: No WIF key provided")
        print("Use --wif or set NEO_WIF environment variable")
        print("\nTo create a new wallet, run:")
        print("  python deploy.py --create-wallet")
        sys.exit(1)
    
    contract_hash = await deploy_contract(args.wif)
    
    if contract_hash:
        # Save contract hash
        config_path = os.path.join(SCRIPT_DIR, "..", "config.json")
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                config = json.load(f)
        else:
            config = {}
        
        config["contract_hash"] = f"0x{contract_hash[::-1].hex()}"
        
        with open(config_path, 'w') as f:
            json.dump(config, f, indent=2)
        
        print(f"\nContract hash saved to config.json")


if __name__ == "__main__":
    asyncio.run(main())
