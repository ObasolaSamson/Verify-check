import type { IRegistryAdapter, RegistrySearchQuery, RegistrySearchResult } from "@/server/registry/adapter";

/** Records that a person must search the registry. There is no public registry API. */
export class ManualRegistryAdapter implements IRegistryAdapter {
  readonly mode = "manual" as const;

  async search(_query: RegistrySearchQuery): Promise<RegistrySearchResult> {
    return { pendingHumanSearch: true };
  }
}

export function getRegistryAdapter(): IRegistryAdapter {
  return new ManualRegistryAdapter();
}
