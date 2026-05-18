import { extractE164 } from "@/lib/whatsapp-clinical-notifier/phone";
import type { TransferIntent } from "@/lib/whatsapp-clinical-notifier/types";

const INTENT_PATTERNS = [/\b(envi[áa]|mand[áa]|comparti[rl])\b/i, /\bprotocolo\b/i, /\btraslado\b/i, /\bwhatsapp\b/i];
const CONFIRM_PATTERN = /confirmo\s+enviar\s+este\s+protocolo\s+por\s+whatsapp/i;
const SOFT_CONFIRM_PATTERN = /\b(si|sí|dale|mandalo|mandalo ya|confirmado)\b/i;
const TRANSFER_LIKE_PATTERN = /\b(envi[áa]r?|mand[áa]r?)\b.*\btraslado\b/i;

export function detectTransferProtocolIntent(message: string): TransferIntent {
  const text = String(message ?? "").trim();
  const isTransferProtocolIntent = INTENT_PATTERNS.every((pattern) => pattern.test(text)) || TRANSFER_LIKE_PATTERN.test(text);
  const destinationMatch = text.match(/\+\d[\d\s\-()]{7,20}/);
  const destinationPhone = destinationMatch ? extractE164(destinationMatch[0]) : null;
  const isExplicitConfirmation = CONFIRM_PATTERN.test(text);
  const isSoftConfirmation = !isExplicitConfirmation && SOFT_CONFIRM_PATTERN.test(text);
  const hasPhoneDigitsHint = /\d{3,}/.test(text);

  return {
    destinationPhone,
    isTransferProtocolIntent,
    isExplicitConfirmation,
    isSoftConfirmation,
    hasPhoneDigitsHint,
  };
}
