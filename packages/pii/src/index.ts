const PII_PATTERNS: { name: string; pattern: RegExp; replacement: string }[] = [
  {
    name: "email",
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: "[EMAIL]",
  },
  {
    name: "phone_us",
    pattern: /(\+1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/g,
    replacement: "[PHONE]",
  },
  {
    name: "ssn",
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: "[SSN]",
  },
  {
    name: "credit_card",
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
    replacement: "[CARD]",
  },
  {
    name: "ip_address",
    pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    replacement: "[IP]",
  },
  {
    name: "api_key_openai",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{10,}\b/g,
    replacement: "[APIKEY]",
  },
  {
    name: "api_key_anthropic",
    pattern: /\bsk-ant-[A-Za-z0-9_-]{10,}\b/g,
    replacement: "[APIKEY]",
  },
  {
    name: "api_key_google",
    pattern: /\bAIza[0-9A-Za-z_-]{30,}\b/g,
    replacement: "[APIKEY]",
  },
  {
    name: "bearer_token",
    pattern: /\bBearer\s+[A-Za-z0-9._-]+\b/gi,
    replacement: "Bearer [APIKEY]",
  },
  {
    name: "generic_secret",
    pattern: /\b(?:sk-|pk-|ak-|xox[baprs]-)[a-zA-Z0-9_-]{10,}\b/g,
    replacement: "[APIKEY]",
  },
];

export function redactPII(text: string): { redacted: string; didRedact: boolean } {
  let redacted = text;
  let didRedact = false;

  for (const { pattern, replacement } of PII_PATTERNS) {
    const original = redacted;
    redacted = redacted.replace(pattern, replacement);
    if (redacted !== original) didRedact = true;
  }

  return { redacted, didRedact };
}

export function sanitizePreview(text: string | undefined): string | undefined {
  if (!text) return undefined;
  return redactPII(text.slice(0, 500)).redacted;
}
