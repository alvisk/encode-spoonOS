"""Very small CLI to run the ToolCallAgent once."""

import argparse
import json

from .agent import build_agent


def main():
    parser = argparse.ArgumentParser(description="Neo Wallet Guardian CLI")
    parser.add_argument("prompt", nargs="*", help="Prompt to send to the agent")
    args = parser.parse_args()
    if not args.prompt:
        raise SystemExit("Provide a prompt, e.g. 'summarize wallet <address>'")

    user_prompt = " ".join(args.prompt)
    agent = build_agent()
    result = agent.run(user_prompt)  # type: ignore[attr-defined]
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()


