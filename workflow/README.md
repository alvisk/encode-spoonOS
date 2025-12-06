# The Workflow (Step-by-Step)

Plan for an autonomous SpoonOS agent that decides when to offload heavy scientific tasks to AIOZ, pays with Neo GAS, and returns results end-to-end.

## Core Components
- **Agent (ToolCallAgent)**: Applies offload logic and orchestrates tools.
- **AIOZ Offloader Tool**: S3-compatible upload to AIOZ W3S, then triggers AIOZ W3AI compute.
- **Neo Payer Tool**: Signs and sends GAS to fund the remote job.
- **Local Capability Check**: Estimates RAM/CPU/time; only offloads when above threshold.

## End-to-End Flow
1) **Task ingestion**: User asks for a job (e.g., “Run a protein folding simulation on this 5GB FASTA dataset.”).
2) **Resource evaluation**: Inspect file size + local RAM/CPU; estimate runtime.
   - Rule: if `required_ram > local_ram` **OR** `estimated_time > 10 minutes` => `offload = True`.
3) **Branch**:
   - If `offload = False`: run locally; return result.
   - If `offload = True`: proceed to remote steps.
4) **Data staging (AIOZ W3S)**:
   - Upload dataset to bucket via S3 API.
   - Produce signed/public URL for compute node.
5) **Payment execution (Neo)**:
   - Estimate cost (flat 2 GAS for demo, or compute based on size/runtime).
   - Sign and broadcast GAS tx to recipient (AIOZ contract or payment address).
6) **Compute trigger (AIOZ W3AI)**:
   - Call W3AI API with data URL + container/model ID.
   - Receive `job_id`.
7) **Result retrieval**:
   - Poll or webhook for completion.
   - Download result from W3S; summarize and return to user.

## Pseudocode (Agent Decision + Tool Calls)
```
system_prompt = """
You are a Scientific Orchestrator Agent.
Rules:
- Check task size/complexity first.
- If dataset > 100MB or model-heavy, do NOT run locally.
- When offloading, call run_remote_compute then pay_gas_fee (~2 GAS).
- Explain the decision to the user.
"""

on_user_task(task):
    dataset = task.dataset_path
    size_gb = get_file_size(dataset)
    local_ram = get_local_ram()
    est_time = estimate_runtime(task)
    offload = (size_gb > 0.1) or (est_time > 10 min) or (size_gb > local_ram/2)

    if not offload:
        return run_locally(task)

    cost = estimate_cost(task) or 2.0  # GAS
    job = run_remote_compute(dataset_path=dataset, task_type=task.type)
    payment = pay_gas_fee(amount=cost, recipient=job.recipient or DEFAULT_RECIPIENT)

    result = wait_for_job(job.job_id)
    download_result(result.url)
    return summarize(result, payment.tx_hash)
```

## Tool Specs (stubs to implement in `src/tools/`)
- `AiozComputeTool` (`run_remote_compute`):
  - Inputs: `dataset_path`, `task_type`.
  - Steps: init S3 client (endpoint `https://s3.aioz.storage`), upload, build data URL, call W3AI API, return `{job_id, storage_url, status}`.
- `NeoPaymentTool` (`pay_gas_fee`):
  - Inputs: `amount`, `recipient`.
  - Steps: load wallet (env/secure store), construct GAS transfer, sign, broadcast, return `tx_hash`.

## Config & Secrets
- `AIOZ_S3_ENDPOINT=https://s3.aioz.storage`
- `AIOZ_ACCESS_KEY=...`
- `AIOZ_SECRET_KEY=...`
- `AIOZ_BUCKET=hackathon-science-tasks`
- `AIOZ_W3AI_ENDPOINT=https://api.aioz.w3ai/compute` (placeholder)
- `NEO_RPC_URL=https://seed1t5.neo.org:20332` (testnet)
- `NEO_PRIVATE_KEY=...`
- `GAS_RECIPIENT=` AIOZ contract or payment wallet

## Data Paths and Security
- Avoid embedding secrets in code; use env vars.
- For the 5GB dataset example, stream upload (multipart) and prefer signed URLs with expiry.
- Store job metadata (job_id, data_url, tx_hash) for later retrieval in a simple JSON log.

## Demo Script (judge-friendly)
1) Show a small local task (“summarize this paragraph”) handled locally.
2) Submit “Run a protein folding simulation on this 5GB FASTA dataset.”
3) Agent prints decision: “Detected large dataset; offloading to AIOZ.”
4) Show upload progress + generated S3 URL.
5) Show “Payment sent: 2 GAS” with block explorer link.
6) Show W3AI job submission + job_id.
7) Show result retrieved from W3S and summarized for the user.

## Next Implementation Steps
- [ ] Add `workflow` tools: `aioz_compute.py`, `neo_payment.py` stubs under `src/tools/`.
- [ ] Add env placeholders to `.env.example`.
- [ ] Update agent prompt to include offload rules and payment requirement.
- [ ] Add CLI command to simulate the 5GB FASTA workflow (dry-run mode for demo).
- [ ] Wire simple dashboard/log output (Local vs AIOZ status) for demo clarity.

