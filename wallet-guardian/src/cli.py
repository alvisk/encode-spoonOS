"""Very small CLI to run the ToolCallAgent once."""

import argparse
import asyncio
import json
import os

from .agent import build_agent


async def run_agent(prompt: str):
    agent = build_agent()
    result = await agent.run(prompt)
    return result


def main():
    parser = argparse.ArgumentParser(description="Neo Wallet Guardian CLI")
    parser.add_argument("prompt", nargs="*", help="Prompt to send to the agent")
    parser.add_argument("--mock", action="store_true", help="Use mock chain data (offline/demo)")
    args = parser.parse_args()
    if not args.prompt:
        raise SystemExit("Provide a prompt, e.g. 'summarize wallet <address>'")

    user_prompt = " ".join(args.prompt)
    if args.mock:
        os.environ["WALLET_GUARDIAN_USE_MOCK"] = "true"
    
    result = asyncio.run(run_agent(user_prompt))
    print(result)


if __name__ == "__main__":
    main()


