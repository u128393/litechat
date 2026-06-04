import { createContext, useContext } from "react";

import type { ChatConversationBranchRecord, ChatConversationRecord, ChatMessageRecord } from "@/lib/chat/local-store";
import type { UserSelectableModel } from "@/shared/types";
import type { ChatMessageAttachment, FileUploadCapabilities } from "@/shared/types";

type ChatFailureState = {
  code: string;
  message: string;
  canRetry: boolean;
};

export type ChatSearchResult = {
  conversation: ChatConversationRecord;
  matchedText: string | null;
  matchedAt: string;
};

export type SearchConversationsOptions = {
  query: string;
  signal: AbortSignal;
  onResult: (result: ChatSearchResult) => void;
};

export type SelectConversationSource = "sidebar" | "search";

export type ConversationRevealRequest = {
  conversationId: string;
  token: number;
};

export type ChatBranchContext = ChatConversationBranchRecord & {
  isPreview: boolean;
};

export type ChatWorkspaceContextValue = {
  conversations: ChatConversationRecord[];
  routeConversationId: string | null;
  activeConversationId: string | null;
  messages: ChatMessageRecord[];
  branchContext: ChatBranchContext | null;
  draft: string;
  models: UserSelectableModel[];
  selectedModelId: string | null;
  fileUploadCapabilities: FileUploadCapabilities;
  hasLoadedConversations: boolean;
  hasOlderConversations: boolean;
  hasNewerConversations: boolean;
  isLoadingOlderConversations: boolean;
  isLoadingNewerConversations: boolean;
  isLoadingModels: boolean;
  isSendingMessage: boolean;
  hasSendingMessage: boolean;
  sendingConversationIds: string[];
  chatError: ChatFailureState | null;
  activeConversationRevealRequest: ConversationRevealRequest | null;
  composerFocusRequestToken: number;
  timelineScrollRequestToken: number;
  createNewConversation(): Promise<void>;
  selectConversation(conversationId: string, options?: { source?: SelectConversationSource }): Promise<void>;
  updateDraft(nextDraft: string): Promise<void>;
  sendMessage(attachments?: ChatMessageAttachment[]): Promise<boolean>;
  stopMessage(): void;
  retryMessage(): Promise<void>;
  regenerateMessage(messageId: string): Promise<void>;
  regenerateFromUserMessage(messageId: string): Promise<void>;
  editUserMessage(messageId: string, nextContent: string): Promise<void>;
  openConversationBranch(messageId: string): Promise<void>;
  clearChatError(): void;
  deleteConversation(conversationId: string): Promise<void>;
  selectModel(modelId: string): Promise<void>;
  refreshModels(): Promise<void>;
  loadOlderConversations(): Promise<void>;
  loadNewerConversations(): Promise<void>;
  listRecentConversations(limit: number): Promise<ChatConversationRecord[]>;
  searchConversations(options: SearchConversationsOptions): Promise<void>;
};

export const ChatWorkspaceContext = createContext<ChatWorkspaceContextValue | null>(null);

export function useChatWorkspace() {
  const contextValue = useContext(ChatWorkspaceContext);

  if (!contextValue) {
    throw new Error("useChatWorkspace must be used within ChatWorkspaceProvider.");
  }

  return contextValue;
}
