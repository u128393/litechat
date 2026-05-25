import type { ChatConversationRecord } from "@/lib/chat/local-store";

export function getConversationDisplayTitle(
  conversation: ChatConversationRecord,
  { branchTitlePrefix }: { branchTitlePrefix: string }
) {
  if (!conversation.branch) {
    return conversation.title;
  }

  return `${branchTitlePrefix}${conversation.branch.sourceConversationTitle || conversation.title}`;
}
