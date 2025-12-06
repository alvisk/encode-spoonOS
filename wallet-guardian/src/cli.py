"""Very small CLI to run the ToolCallAgent once."""

import argparse
import json
import os

from .agent import build_agent


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
    agent = build_agent()
    result = agent.run(user_prompt)  # type: ignore[attr-defined]
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()


