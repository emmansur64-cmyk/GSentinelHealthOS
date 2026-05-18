export type TransferNotificationAction =
  | "SEND_TRANSFER_PROTOCOL_WHATSAPP"
  | "SEND_TRANSFER_PROTOCOL_WHATSAPP_PREVIEW"
  | "SEND_TRANSFER_PROTOCOL_WHATSAPP_MISSING_DATA"
  | "SEND_TRANSFER_PROTOCOL_WHATSAPP_CONFIRM_REQUIRED"
  | "SEND_TRANSFER_PROTOCOL_WHATSAPP_DISPATCHED"
  | "SEND_TRANSFER_PROTOCOL_WHATSAPP_DRY_RUN"
  | "SEND_TRANSFER_PROTOCOL_WHATSAPP_DENIED";

export type TransferIntent = {
  destinationPhone: string | null;
  isTransferProtocolIntent: boolean;
  isExplicitConfirmation: boolean;
};

export type TransferPreviewPayload = {
  destinationPhone: string;
  patientId: string;
  patientLabel: string;
  reason: string;
  protocolSummary: string;
  senderName: string;
  senderLicense: string;
  senderDirectPhone: string;
  messageBody: string;
  contentHash: string;
  createdAt: string;
};
