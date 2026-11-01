export type Persona = {
  name?: string;
  tone?: string;
  sampleReplies?: string[];
};

export type HandoffRules = {
  alwaysHandoff?: boolean;
  keywords?: string[];
  onOrder?: boolean;
  onComplaint?: boolean;
};

export type ProductVariants = {
  sizes?: string[];
  colors?: string[];
};

export type Attachment = {
  type: string;
  url?: string;
};

export type MessageAiMetadata = {
  confidence?: number;
  intent?: string;
  needsHuman?: boolean;
  handoffReason?: string;
  sourceIds?: string[];
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type LeadItem = {
  name: string;
  quantity?: number;
  variant?: string;
  price?: number;
};
