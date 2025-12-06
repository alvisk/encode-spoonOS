from __future__ import annotations

import os
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


_SIZE_THRESHOLD_BYTES = 100 * 1024 * 1024  # 100MB default
_TIME_THRESHOLD_MINUTES = 10


@dataclass
class OffloadResult:
    offloaded: bool
    job_id: str
    storage_url: Optional[str]
    payment_tx: Optional[str]
    status: str
    message: str


class OffloadService:
    """Decide whether to offload and (for now) simulate the remote call."""

    def __init__(self, size_threshold_bytes: int = _SIZE_THRESHOLD_BYTES, time_threshold_minutes: int = _TIME_THRESHOLD_MINUTES) -> None:
        self.size_threshold_bytes = size_threshold_bytes
        self.time_threshold_minutes = time_threshold_minutes

    def offload_task(self, dataset_path: str, task_type: str, dry_run: bool = True) -> OffloadResult:
        size_bytes = self._safe_get_size(dataset_path)
        est_minutes = self._estimate_runtime_minutes(size_bytes, task_type)
        offload = self._should_offload(size_bytes, est_minutes)

        # TODO: replace simulation with real tools:
        # - run_remote_compute (AiozComputeTool)
        # - pay_gas_fee (NeoPaymentTool)
        simulated_job_id = f"job-{uuid.uuid4().hex[:8]}"
        simulated_storage_url = f"https://example.s3.aioz.storage/tasks/{Path(dataset_path).name}"
        simulated_payment = "tx-dry-run" if offload else None
        status = "submitted" if offload else "local"
        message = (
            "Offloaded to AIOZ (simulated; dry_run=True)."
            if offload
            else "Handled locally (below thresholds)."
        )

        if not dry_run and offload:
            # This is where real tool calls will be wired.
            message = "Offload requested but not yet implemented; dry_run recommended."

        return OffloadResult(
            offloaded=offload,
            job_id=simulated_job_id,
            storage_url=simulated_storage_url if offload else None,
            payment_tx=simulated_payment,
            status=status,
            message=message,
        )

    def _should_offload(self, size_bytes: Optional[int], est_minutes: float) -> bool:
        if size_bytes is None:
            return est_minutes > self.time_threshold_minutes
        return size_bytes > self.size_threshold_bytes or est_minutes > self.time_threshold_minutes

    def _safe_get_size(self, dataset_path: str) -> Optional[int]:
        try:
            return os.path.getsize(dataset_path)
        except (FileNotFoundError, OSError):
            return None

    def _estimate_runtime_minutes(self, size_bytes: Optional[int], task_type: str) -> float:
        # Simple heuristic; adjust per task_type as models become available.
        if size_bytes is None:
            return self.time_threshold_minutes + 1
        gb = size_bytes / (1024**3)
        base = 2.0 if task_type else 2.0
        return max(base, gb * 8)  # assume ~8 minutes per GB as a placeholder


