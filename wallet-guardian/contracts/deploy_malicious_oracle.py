#!/usr/bin/env python3
"""
Deploy Malicious Contract Oracle to Neo N3 Testnet

This script deploys the malicious_contract_oracle.py smart contract
to the Neo N3 Testnet.

Usage:
    python deploy_malicious_oracle.py --wif YOUR_WIF_KEY
    
Or set environment variable:
    export NEO_WIF=YOUR_WIF_KEY
    python deploy_malicious_oracle.py

Prerequisites:
    1. neo3-boa installed: pip install neo3-boa
    2. Compile the contract first: neo3-boa compile malicious_contract_oracle.py
    3. Have NEO/GAS on testnet (get from https://neowish.ngd.network/)
"""

import argparse
import asyncio
import json
import os
import sys
from pathlib import Path

# Try to import neo3 libraries
try:
    from neo3.api.wrappers import ChainFacade, NeoToken, GasToken, GenericContract
    from neo3.api.helpers.signing import sign_insecure_with_account
    from neo3.wallet.account import Account
    from neo3.network.payloads.verification import Signer
    from neo3.core.types import UInt160
    from neo3.contracts.nef import NEF
    from neo3.contracts.manifest import ContractManifest
except ImportError as e:
    print(f"ERROR: neo3 libraries not installed or wrong version: {e}")
    print("Install with: pip install neo-mamba")
    sys.exit(1)


# Neo N3 Testnet RPC
TESTNET_RPC = "https://testnet1.neo.coz.io:443"

# Contract files
SCRIPT_DIR = Path(__file__).parent
CONTRACT_NAME = "malicious_contract_oracle"
NEF_PATH = SCRIPT_DIR / f"{CONTRACT_NAME}.nef"
MANIFEST_PATH = SCRIPT_DIR / f"{CONTRACT_NAME}.manifest.json"
CONFIG_PATH = SCRIPT_DIR.parent / "config.json"


def compile_contract():
    """Compile the smart contract using neo3-boa."""
    source_path = SCRIPT_DIR / f"{CONTRACT_NAME}.py"
    
    if not source_path.exists():
        print(f"ERROR: Source file not found: {source_path}")
        return False
    
    try:
        from boa3.boa3 import Boa3
        
        print(f"Compiling {source_path}...")
        Boa3.compile_and_save(str(source_path))
        print("Compilation successful!")
        return True
    except ImportError:
        print("WARNING: neo3-boa not installed. Cannot compile.")
        print("Install with: pip install neo3-boa")
        print("Or compile manually: neo3-boa compile malicious_contract_oracle.py")
        return False
    except Exception as e:
        print(f"ERROR during compilation: {e}")
        return False


async def get_balance(facade: ChainFacade, script_hash: UInt160) -> tuple:
    """Get NEO and GAS balance for an address."""
    neo = NeoToken()
    gas = GasToken()
    
    neo_result = await facade.test_invoke(neo.balance_of(script_hash))
    gas_result = await facade.test_invoke(gas.balance_of(script_hash))
    
    neo_balance = neo_result.result if hasattr(neo_result, 'result') else 0
    gas_balance = gas_result.result if hasattr(gas_result, 'result') else 0
    
    return int(neo_balance), int(gas_balance) / 100000000


async def deploy_contract(wif: str, api_url: str = None):
    """Deploy the malicious contract oracle."""
    
    # Check if compiled contract exists
    if not NEF_PATH.exists():
        print(f"Compiled contract not found: {NEF_PATH}")
        print("Attempting to compile...")
        if not compile_contract():
            print("\nPlease compile the contract manually:")
            print(f"  neo3-boa compile {SCRIPT_DIR / f'{CONTRACT_NAME}.py'}")
            return None
    
    if not MANIFEST_PATH.exists():
        print(f"Manifest not found: {MANIFEST_PATH}")
        return None
    
    # Load account from WIF
    account = Account.from_wif(wif, password='')
    print(f"\n{'='*60}")
    print(f"  Deploying Malicious Contract Oracle")
    print(f"{'='*60}")
    print(f"  Address: {account.address}")
    print(f"  Script Hash: {account.script_hash}")
    
    # Connect to testnet
    facade = ChainFacade.node_provider_testnet()
    print(f"  Network: Neo N3 Testnet")
    
    # Check balance
    neo_bal, gas_bal = await get_balance(facade, account.script_hash)
    print(f"  Balance: {neo_bal} NEO, {gas_bal:.4f} GAS")
    
    if gas_bal < 15:
        print(f"\n{'='*60}")
        print("  ERROR: Insufficient GAS")
        print(f"{'='*60}")
        print(f"  Need at least 15 GAS to deploy contract")
        print(f"  Current balance: {gas_bal:.4f} GAS")
        print(f"\n  Get testnet GAS from: https://neowish.ngd.network/")
        return None
    
    # Load contract files
    print(f"\n  Loading contract files...")
    
    with open(NEF_PATH, 'rb') as f:
        nef_data = f.read()
    nef = NEF.deserialize_from_bytes(nef_data)
    
    with open(MANIFEST_PATH, 'r') as f:
        manifest_dict = json.load(f)
    manifest = ContractManifest.from_json(manifest_dict)
    
    print(f"  Contract Name: {manifest.name}")
    print(f"  Methods: {len(manifest.abi.methods)}")
    
    # Deploy using ContractManagement
    print(f"\n  Deploying contract...")
    
    # ContractManagement hash on Neo N3
    contract_management_hash = UInt160.from_string("fffdc93764dbaddd97c48f252a53ea4643faa3fd")
    
    contract_mgmt = GenericContract(contract_management_hash)
    
    # Build deployment call with nef bytes and manifest json
    manifest_bytes = json.dumps(manifest_dict).encode('utf-8')
    
    deploy_call = contract_mgmt.call_function(
        "deploy",
        [nef_data, manifest_bytes, None]  # nef, manifest, data
    )
    
    # Add signer using insecure signing (for testnet)
    facade.add_signer(
        sign_insecure_with_account(account, password=''),
        Signer(account.script_hash)
    )
    
    # Invoke
    try:
        result = await facade.invoke(deploy_call)
        tx_hash = str(result) if result else "Unknown"
        
        print(f"\n  Transaction: {tx_hash}")
        print(f"\n  Waiting for confirmation...")
        
        # Wait for transaction
        await asyncio.sleep(20)
        
        # Calculate contract hash from sender + nef checksum + name
        import hashlib
        
        # The contract hash is calculated from: sender_scripthash + nef_checksum + contract_name
        sender_bytes = account.script_hash.to_array()
        nef_checksum = nef.checksum.to_bytes(4, 'little')
        name_bytes = manifest.name.encode('utf-8')
        
        data = sender_bytes + nef_checksum + name_bytes
        hash_result = hashlib.sha256(data).digest()
        hash_result = hashlib.new('ripemd160', hash_result).digest()
        contract_hash = UInt160(hash_result)
        contract_hash_str = f"0x{contract_hash}"
        
        print(f"\n{'='*60}")
        print(f"  Deployment Successful!")
        print(f"{'='*60}")
        print(f"  Contract Hash: {contract_hash_str}")
        print(f"  Explorer: https://testnet.neotube.io/contract/{contract_hash_str}")
        
        # Save to config
        config = {}
        if CONFIG_PATH.exists():
            with open(CONFIG_PATH, 'r') as f:
                config = json.load(f)
        
        config["malicious_oracle_hash"] = contract_hash_str
        
        with open(CONFIG_PATH, 'w') as f:
            json.dump(config, f, indent=2)
        
        print(f"\n  Contract hash saved to: {CONFIG_PATH}")
        
        # Update API URL if provided
        if api_url:
            print(f"\n  Setting API URL: {api_url}")
            print(f"  (API URL can be set later via set_api_url)")
        
        print(f"\n{'='*60}")
        print(f"  Available Methods:")
        print(f"{'='*60}")
        print(f"  - request_contract_scan(address)  : Request Oracle analysis")
        print(f"  - get_risk_score(address)         : Get cached risk score")
        print(f"  - is_malicious(address)           : Check if contract is malicious")
        print(f"  - get_risk_level(address)         : Get risk level string")
        print(f"  - get_issues(address)             : Get detected issues")
        print(f"  - get_summary(address)            : Get explanation summary")
        print(f"  - get_full_analysis(address)      : Get complete analysis")
        print(f"  - is_safe_to_interact(addr, max)  : Check if safe to interact")
        print(f"{'='*60}")
        
        return contract_hash_str
    
    except Exception as e:
        print(f"\n  ERROR during deployment: {e}")
        import traceback
        traceback.print_exc()
        return None


async def main():
    parser = argparse.ArgumentParser(
        description="Deploy Malicious Contract Oracle to Neo N3 Testnet"
    )
    parser.add_argument(
        "--wif",
        help="WIF private key",
        default=os.environ.get("NEO_WIF")
    )
    parser.add_argument(
        "--check-balance",
        action="store_true",
        help="Only check balance, don't deploy"
    )
    parser.add_argument(
        "--compile-only",
        action="store_true",
        help="Only compile the contract, don't deploy"
    )
    parser.add_argument(
        "--api-url",
        help="API URL for Oracle to call (optional)",
        default=None
    )
    args = parser.parse_args()
    
    if args.compile_only:
        compile_contract()
        return
    
    if not args.wif:
        print("ERROR: No WIF key provided")
        print("\nUsage:")
        print("  python deploy_malicious_oracle.py --wif YOUR_WIF_KEY")
        print("\nOr set environment variable:")
        print("  export NEO_WIF=YOUR_WIF_KEY")
        print("  python deploy_malicious_oracle.py")
        print("\nTo check balance only:")
        print("  python deploy_malicious_oracle.py --wif YOUR_WIF --check-balance")
        print("\nTo compile only:")
        print("  python deploy_malicious_oracle.py --compile-only")
        sys.exit(1)
    
    if args.check_balance:
        account = Account.from_wif(args.wif, password='')
        print(f"\n{'='*60}")
        print(f"  Neo N3 Wallet")
        print(f"{'='*60}")
        print(f"  Address: {account.address}")
        print(f"  Script Hash: {account.script_hash}")
        
        facade = ChainFacade.node_provider_testnet()
        neo_bal, gas_bal = await get_balance(facade, account.script_hash)
        print(f"  Balance: {neo_bal} NEO, {gas_bal:.4f} GAS")
        
        if gas_bal < 15:
            print(f"\n  WARNING: Need at least 15 GAS to deploy")
            print(f"  Get testnet GAS from: https://neowish.ngd.network/")
        else:
            print(f"\n  Ready to deploy! Run without --check-balance")
        print(f"{'='*60}")
        return
    
    await deploy_contract(args.wif, args.api_url)


if __name__ == "__main__":
    asyncio.run(main())
