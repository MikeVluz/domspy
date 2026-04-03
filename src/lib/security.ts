/**
 * Security utilities for DomSpy
 */

// ===== SSRF Protection =====

const BLOCKED_IP_PATTERNS = [
  /^127\./, /^0\.0\.0\.0$/, /^localhost$/i,
  /^10\./, /^192\.168\./, /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^169\.254\./, /^::1$/, /^fe80:/i, /^fc00:/i, /^fd/i,
  /^0:0:0:0:0:0:0:1$/,
];

const BLOCKED_PROTOCOLS = ["file:", "ftp:", "gopher:", "data:", "javascript:"];

export function isUrlSafe(url: string): { safe: boolean; reason?: string } {
  try {
    const parsed = new URL(url);

    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { safe: false, reason: `Protocolo bloqueado: ${parsed.protocol}` };
    }

    if (BLOCKED_PROTOCOLS.includes(parsed.protocol)) {
      return { safe: false, reason: "Protocolo nao permitido" };
    }

    const hostname = parsed.hostname;

    for (const pattern of BLOCKED_IP_PATTERNS) {
      if (pattern.test(hostname)) {
        return { safe: false, reason: "Endereco IP interno bloqueado" };
      }
    }

    // Block numeric IPs that could resolve to internal addresses
    if (/^\d+$/.test(hostname)) {
      return { safe: false, reason: "IP numerico nao permitido" };
    }

    return { safe: true };
  } catch {
    return { safe: false, reason: "URL invalida" };
  }
}

// ===== Rate Limiting =====

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

// Clean old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of rateLimitStore) {
    if (val.resetAt < now) rateLimitStore.delete(key);
  }
}, 60000);

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { allowed: boolean; remaining: number; resetIn: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt < now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs };
  }

  entry.count++;

  if (entry.count > maxRequests) {
    return { allowed: false, remaining: 0, resetIn: entry.resetAt - now };
  }

  return { allowed: true, remaining: maxRequests - entry.count, resetIn: entry.resetAt - now };
}

// ===== Input Validation =====

export function sanitizeString(input: string, maxLength: number = 500): string {
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/[<>]/g, ""); // Remove basic HTML chars
}

export function validateUrl(url: string): { valid: boolean; error?: string } {
  if (!url || url.length > 2048) {
    return { valid: false, error: "URL muito longa (max 2048 caracteres)" };
  }

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { valid: false, error: "URL deve usar http:// ou https://" };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: "URL invalida" };
  }
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320;
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) return { valid: false, error: "Senha deve ter pelo menos 8 caracteres" };
  if (password.length > 128) return { valid: false, error: "Senha muito longa" };
  return { valid: true };
}

// ===== Error Sanitization =====

export function safeErrorMessage(error: unknown): string {
  // Never expose internal errors to clients
  if (process.env.NODE_ENV === "development") {
    return String(error);
  }
  return "Ocorreu um erro interno";
}
