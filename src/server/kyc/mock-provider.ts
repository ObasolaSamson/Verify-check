import { last4 } from "@/lib/crypto";
import type { KycLookup, KycProvider } from "@/server/kyc/provider";

export class MockKycProvider implements KycProvider {
  readonly name = "mock" as const;

  async lookup(input: KycLookup) {
    const raw = input.type === "NIN" ? input.nin : input.type === "BVN" ? input.bvn : input.rcNumber;
    return {
      status: "passed" as const,
      reference: `MOCK-${input.type}-${Date.now()}`,
      last4: last4(raw),
    };
  }
}

export function getKycProvider(): KycProvider {
  return new MockKycProvider();
}
