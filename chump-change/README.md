# Chump Change

Micro-donation and payment-splitter concept for Neo. A SpoonOS agent intercepts payments, rounds up or applies a small fee, and routes the remainder to a configured charity vault with transparent on-chain logs.

## Contents
- `proposal.md`: high-level concept and prize alignment.
- `docs/`: partner-specific notes (4Everland, Neo, XerpaAI, SpoonOS).

## Next steps
- Define the Neo vault contract interface and donation calculation rules.
- Sketch the SpoonOS co-signer/approver agent that rebuilds transactions with the donation.
- Add a simple demo flow (CLI or HTTP) that shows payment + donation bundling.

