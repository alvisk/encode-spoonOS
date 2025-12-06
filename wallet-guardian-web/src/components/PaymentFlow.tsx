"use client";

import { useState, useEffect, useCallback } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useSwitchChain,
  useChainId,
  useWalletClient,
} from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { formatUnits } from "viem";
import {
  Wallet,
  CheckCircle2,
  CircleDot,
  Loader2,
  AlertCircle,
  ExternalLink,
  ChevronRight,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { USDC_ADDRESS, USDC_ABI } from "~/lib/wagmi";
import { createPaymentHeader } from "x402/client";
import type { PaymentRequirements } from "x402/types";

// x402 Payment Requirements from 402 response
type X402Requirements = {
  scheme: string;
  network: string;
  maxAmountRequired: string;
  payTo: string;
  asset: string;
  resource?: string;
  description?: string;
  mimeType?: string;
  maxTimeoutSeconds?: number;
  outputSchema?: Record<string, unknown> | null;
  extra?: {
    name?: string;
    version?: string;
    decimals?: number;
    currency?: string;
    memo?: string;
  };
};

type PaymentStep = "connect" | "switch-network" | "check-balance" | "sign" | "complete";

type PaymentFlowProps = {
  requirements: X402Requirements;
  onPaymentComplete: (paymentHeader: string) => void;
  onCancel: () => void;
};

export function PaymentFlow({ requirements, onPaymentComplete, onCancel }: PaymentFlowProps) {
  const [currentStep, setCurrentStep] = useState<PaymentStep>("connect");
  const [error, setError] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { data: walletClient } = useWalletClient();

  const decimals = requirements.extra?.decimals ?? 6;
  const amountRequired = BigInt(requirements.maxAmountRequired);
  const formattedAmount = formatUnits(amountRequired, decimals);
  const payToAddress = requirements.payTo as `0x${string}`;

  // Read USDC balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: USDC_ADDRESS,
    abi: USDC_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });

  // Update step based on state
  useEffect(() => {
    if (!isConnected) {
      setCurrentStep("connect");
    } else if (chainId !== baseSepolia.id) {
      setCurrentStep("switch-network");
    } else if (balance !== undefined) {
      if (balance < amountRequired) {
        setCurrentStep("check-balance");
        setError(`Insufficient USDC balance. You have ${formatUnits(balance, decimals)} USDC but need ${formattedAmount} USDC.`);
      } else {
        setCurrentStep("sign");
        setError(null);
      }
    }
  }, [isConnected, chainId, balance, amountRequired, decimals, formattedAmount]);

  // Handle signing the payment authorization using x402 library
  const handleSignPayment = useCallback(async () => {
    if (!walletClient || !address) {
      setError("Wallet not connected");
      return;
    }

    setIsSigning(true);
    setError(null);

    try {
      // Convert requirements to x402 PaymentRequirements format
      const paymentRequirements: PaymentRequirements = {
        scheme: requirements.scheme as "exact",
        network: requirements.network as "base-sepolia",
        maxAmountRequired: requirements.maxAmountRequired,
        resource: requirements.resource ?? "https://localhost/spoon/agent",
        description: requirements.description ?? "SpoonOS agent service",
        mimeType: requirements.mimeType ?? "application/json",
        payTo: requirements.payTo as `0x${string}`,
        maxTimeoutSeconds: requirements.maxTimeoutSeconds ?? 120,
        asset: requirements.asset as `0x${string}`,
        extra: requirements.extra,
      };

      // Use x402 library to create the payment header
      // The walletClient from wagmi is compatible with x402's EvmSigner type
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-explicit-any
      const paymentHeader = await createPaymentHeader(
        walletClient as unknown as Parameters<typeof createPaymentHeader>[0],
        1, // x402 version
        paymentRequirements
      );

      setCurrentStep("complete");
      onPaymentComplete(paymentHeader);
    } catch (err) {
      console.error("Payment signing error:", err);
      setError(err instanceof Error ? err.message : "Failed to sign payment");
    } finally {
      setIsSigning(false);
    }
  }, [walletClient, address, requirements, onPaymentComplete]);

  const steps = [
    { id: "connect", label: "Connect Wallet" },
    { id: "switch-network", label: "Switch Network" },
    { id: "sign", label: "Authorize Payment" },
    { id: "complete", label: "Complete" },
  ];

  const getStepStatus = (stepId: string) => {
    const stepOrder = ["connect", "switch-network", "sign", "complete"];
    const currentIndex = stepOrder.indexOf(currentStep === "check-balance" ? "sign" : currentStep);
    const stepIndex = stepOrder.indexOf(stepId);

    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "current";
    return "pending";
  };

  return (
    <div className="neo-card border-4 border-black bg-gradient-to-br from-[#1a1a2e] to-[#0f0f1a] p-6 text-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-black text-[#FFFF00] uppercase tracking-widest">
            x402 Payment
          </h3>
          <p className="text-xs text-white/60 mt-1">
            Sign to authorize payment (gasless)
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-black text-[#00FF00]">{formattedAmount}</p>
          <p className="text-xs text-white/60 uppercase">USDC</p>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center gap-2 mb-6 p-3 bg-black/30 border-2 border-white/10">
        {steps.map((step, index) => {
          const status = getStepStatus(step.id);
          return (
            <div key={step.id} className="flex items-center">
              <div className="flex items-center gap-2">
                {status === "completed" ? (
                  <CheckCircle2 className="h-5 w-5 text-[#00FF00]" />
                ) : status === "current" ? (
                  <CircleDot className="h-5 w-5 text-[#FFFF00]" />
                ) : (
                  <div className="h-5 w-5 rounded-full border-2 border-white/30" />
                )}
                <span
                  className={`text-xs font-bold uppercase tracking-wide ${
                    status === "completed"
                      ? "text-[#00FF00]"
                      : status === "current"
                      ? "text-[#FFFF00]"
                      : "text-white/40"
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {index < steps.length - 1 && (
                <ChevronRight className="h-4 w-4 text-white/30 mx-2" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <div className="space-y-4">
        {/* Step 1: Connect Wallet */}
        {currentStep === "connect" && (
          <div className="space-y-4">
            <p className="text-sm text-white/80">
              Connect your wallet to pay with USDC on Base Sepolia.
            </p>
            <div className="grid gap-3">
              {connectors.map((connector) => (
                <Button
                  key={connector.uid}
                  onClick={() => connect({ connector })}
                  disabled={isConnecting}
                  className="w-full neo-button border-4 border-black bg-white text-black shadow-[6px_6px_0_0_#FFFF00] transition-none hover:translate-x-1 hover:translate-y-1 hover:shadow-[3px_3px_0_0_#FFFF00] active:translate-x-2 active:translate-y-2 active:shadow-none uppercase tracking-wider font-black justify-start gap-3"
                >
                  <Wallet className="h-5 w-5" />
                  {isConnecting ? "Connecting..." : connector.name}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Switch Network */}
        {currentStep === "switch-network" && (
          <div className="space-y-4">
            <div className="p-4 bg-[#FFFF00]/10 border-2 border-[#FFFF00]/30">
              <p className="text-sm text-white/80">
                Please switch to <span className="font-black text-[#00BFFF]">Base Sepolia</span> network to continue.
              </p>
            </div>
            <Button
              onClick={() => switchChain({ chainId: baseSepolia.id })}
              disabled={isSwitching}
              className="w-full neo-button border-4 border-black bg-[#00BFFF] text-black shadow-[6px_6px_0_0_#000] transition-none hover:translate-x-1 hover:translate-y-1 hover:shadow-[3px_3px_0_0_#000] active:translate-x-2 active:translate-y-2 active:shadow-none uppercase tracking-wider font-black"
            >
              {isSwitching ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Switching...
                </>
              ) : (
                "Switch to Base Sepolia"
              )}
            </Button>
          </div>
        )}

        {/* Step 3: Check Balance (Error State) */}
        {currentStep === "check-balance" && (
          <div className="space-y-4">
            <div className="p-4 bg-[#FF0000]/10 border-2 border-[#FF0000]/30">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-[#FF0000] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-[#FF0000]">Insufficient Balance</p>
                  <p className="text-xs text-white/70 mt-1">{error}</p>
                </div>
              </div>
            </div>
            <div className="p-4 bg-white/5 border-2 border-white/10">
              <p className="text-xs text-white/60 mb-2">Get testnet USDC from:</p>
              <a
                href="https://faucet.circle.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm font-bold text-[#00BFFF] hover:underline"
              >
                Circle Faucet <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            <Button
              onClick={() => refetchBalance()}
              className="w-full neo-button border-4 border-black bg-white text-black shadow-[6px_6px_0_0_#000] transition-none hover:translate-x-1 hover:translate-y-1 hover:shadow-[3px_3px_0_0_#000] active:translate-x-2 active:translate-y-2 active:shadow-none uppercase tracking-wider font-black"
            >
              Check Balance Again
            </Button>
          </div>
        )}

        {/* Step 4: Sign Payment Authorization */}
        {currentStep === "sign" && (
          <div className="space-y-4">
            <div className="p-4 bg-white/5 border-2 border-white/10">
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-white/60">Amount:</span>
                  <span className="font-black text-[#00FF00]">{formattedAmount} USDC</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">To:</span>
                  <span className="font-mono text-xs text-white/80 truncate max-w-[200px]">
                    {payToAddress}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60">Your Balance:</span>
                  <span className="font-bold text-white">
                    {balance ? formatUnits(balance, decimals) : "0"} USDC
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-[#00BFFF]/10 border-2 border-[#00BFFF]/30">
              <p className="text-xs text-[#00BFFF]">
                This uses x402 gasless payments. You only sign a message - no gas fees required!
              </p>
            </div>

            {error && (
              <div className="p-3 bg-[#FF0000]/10 border-2 border-[#FF0000]/30">
                <p className="text-xs text-[#FF0000]">{error}</p>
              </div>
            )}

            <Button
              onClick={handleSignPayment}
              disabled={isSigning}
              className="w-full neo-button border-4 border-black bg-[#00FF00] text-black shadow-[6px_6px_0_0_#000] transition-none hover:translate-x-1 hover:translate-y-1 hover:shadow-[3px_3px_0_0_#000] active:translate-x-2 active:translate-y-2 active:shadow-none uppercase tracking-wider font-black"
            >
              {isSigning ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sign in Wallet...
                </>
              ) : (
                `Authorize ${formattedAmount} USDC`
              )}
            </Button>
          </div>
        )}

        {/* Step 5: Complete */}
        {currentStep === "complete" && (
          <div className="space-y-4">
            <div className="p-4 bg-[#00FF00]/10 border-2 border-[#00FF00]/30 text-center">
              <CheckCircle2 className="h-12 w-12 text-[#00FF00] mx-auto mb-3" />
              <p className="text-lg font-black text-[#00FF00]">Payment Authorized!</p>
              <p className="text-xs text-white/60 mt-1">
                Processing your analysis request...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
        {isConnected && currentStep !== "complete" && (
          <button
            onClick={() => disconnect()}
            className="text-xs text-white/50 hover:text-white/80 uppercase tracking-wide"
          >
            Disconnect Wallet
          </button>
        )}
        <div className="flex-1" />
        <Button
          onClick={onCancel}
          variant="ghost"
          className="text-white/60 hover:text-white hover:bg-white/10 uppercase tracking-wide text-xs"
        >
          Cancel
        </Button>
      </div>

      {/* Connected Address Display */}
      {isConnected && address && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-white/40 font-mono">
            Connected: {address.slice(0, 6)}...{address.slice(-4)}
          </p>
        </div>
      )}
    </div>
  );
}
