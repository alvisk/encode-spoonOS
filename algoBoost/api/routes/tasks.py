"""Task offload endpoints for AlgoBoost workflows."""

from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from ..deps import get_agent


router = APIRouter()


class OffloadRequest(BaseModel):
    dataset_path: str = Field(...,
                              description="Local path to the dataset to process.")
    task_type: str = Field(
        "protein_folding", description="Type of compute task.")
    dataset_size_gb: Optional[float] = Field(
        None, description="Dataset size hint for decisioning."
    )
    dry_run: bool = Field(
        True,
        description="If true, skip real upload/payment and return a simulated job.",
    )


class OffloadResponse(BaseModel):
    job_id: str
    status: str
    storage_url: Optional[str] = None
    tx_hash: Optional[str] = None
    message: Optional[str] = None


class TaskStatusResponse(BaseModel):
    job_id: str
    status: str
    storage_url: Optional[str] = None
    result_url: Optional[str] = None
    message: Optional[str] = None


def _should_offload(size_gb: Optional[float]) -> bool:
    if size_gb is None:
        return True
    return size_gb > 0.1


@router.post("/offload", response_model=OffloadResponse)
def offload_task(payload: OffloadRequest, agent=Depends(get_agent)):
    """Decide to offload and return a stubbed job record for the UI."""
    _ = agent  # placeholder: future use for prompt-driven decisions

    if not _should_offload(payload.dataset_size_gb):
        return OffloadResponse(
            job_id="local-run",
            status="local",
            message="Dataset small enough to run locally.",
        )

    job_id = f"job-{uuid4().hex[:8]}"

    # Placeholder URLs/hashes; replace with AiozComputeTool + NeoPaymentTool outputs.
    storage_url = f"https://example.aioz.storage/tasks/{job_id}"
    tx_hash = "simulated-gas-tx-hash"

    if payload.dry_run:
        return OffloadResponse(
            job_id=job_id,
            status="queued",
            storage_url=storage_url,
            tx_hash=tx_hash,
            message="Dry-run mode; integrate AiozComputeTool and NeoPaymentTool for live runs.",
        )

    # TODO: call AiozComputeTool.run_remote_compute and NeoPaymentTool.pay_gas_fee
    return OffloadResponse(
        job_id=job_id,
        status="submitted",
        storage_url=storage_url,
        tx_hash=tx_hash,
        message="Live mode not yet wired; stub response returned.",
    )


@router.get("/{job_id}", response_model=TaskStatusResponse)
def get_task_status(job_id: str):
    """Stubbed status endpoint for polling from the UI."""
    return TaskStatusResponse(
        job_id=job_id,
        status="queued",
        storage_url=f"https://example.aioz.storage/tasks/{job_id}",
        result_url=None,
        message="Status stub; connect to W3AI job polling once available.",
    )






