export type RegistrySearchQuery = {
  stateCode: string;
  documentType: string;
  registrationNumber?: string;
  volume?: string;
  page?: string;
  fileNumber?: string;
  nameOnDocument?: string;
};

export type RegistrySearchResult = {
  pendingHumanSearch: boolean;
  receiptNumber?: string;
  isRegistered?: boolean;
  registeredOwner?: string;
  findings?: string;
};

export interface IRegistryAdapter {
  readonly mode: "manual" | "api";
  search(query: RegistrySearchQuery): Promise<RegistrySearchResult>;
}
