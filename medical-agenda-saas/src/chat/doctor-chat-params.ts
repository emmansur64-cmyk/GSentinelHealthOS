export const DOCTOR_CHAT_PARAMS = {
  route: "/chat/doctor",
  channel: "doctor_chat",
  auditEntityType: "doctor_chat",
  clearAction: "doctor.chat.clear",
  exchangeAction: "doctor.chat.exchange",
  completedEvent: "doctor_chat.completed",
  sessionMetadataKey: "chat_session_id",
  conversationPrefix: "doctor",
} as const;

export type DoctorChatChannel = typeof DOCTOR_CHAT_PARAMS.channel;
