export function fitTextBudget(parts: string[], maxChars: number): string {
  const output: string[] = [];
  let used = 0;

  for (const part of parts) {
    const addition = part.trim();
    if (!addition) continue;
    const nextLength = used + addition.length + (output.length ? 1 : 0);
    if (nextLength > maxChars) break;
    output.push(addition);
    used = nextLength;
  }

  return output.join("\n");
}

