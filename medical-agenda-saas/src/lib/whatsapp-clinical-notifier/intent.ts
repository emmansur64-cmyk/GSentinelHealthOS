import { extractE164 } from "@/lib/whatsapp-clinical-notifier/phone";
import type { TransferIntent } from "@/lib/whatsapp-clinical-notifier/types";

const INTENT_PATTERNS = [/\b(envi[áa]|mand[áa]|comparti[rl])\b/i, /\bprotocolo\b/i, /\btraslado\b/i, /\bwhatsapp\b/i];
const CONFIRM_PATTERN = /confirmo\s+enviar\s+este\s+protocolo\s+por\s+whatsapp/i;

export function detectTransferProtocolIntent(message: string): TransferIntent {
  const text = String(message ?? "").trim();
  const isTransferProtocolIntent = INTENT_PATTERNS.every((pattern) => pattern.test(text));
  const destinationMatch = text.match(/\+\d[\d\s\-()]{7,20}/);
  const destinationPhone = destinationMatch ? extractE164(destinationMatch[0]) : null;
  const isExplicitConfirmation = CONFIRM_PATTERN.test(text);

  return {
    destinationPhone,
    isTransferProtocolIntent,
    isExplicitConfirmation,
  };
}
