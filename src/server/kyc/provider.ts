export type KycLookup =
  | { type: "NIN"; nin: string }
  | { type: "BVN"; bvn: string }
  | { type: "CAC"; rcNumber: string };

export type KycLookupResult = {
  status: "passed" | "failed" | "error";
  reference: string;
  matchedName?: string;
  last4?: string;
};

export interface KycProvider {
  readonly name: "mock" | "prembly" | "dojah" | "smile_id";
  lookup(input: KycLookup): Promise<KycLookupResult>;
}
