/**
 * Strict email validation that catches common formatting errors:
 * - Trailing dot before @: xxx.@yahoo.fr
 * - Leading dot: .xxx@yahoo.fr
 * - Consecutive dots: xx..yy@yahoo.fr
 * - Spaces anywhere
 * - Missing or invalid domain
 * - Trailing dot in domain
 */
export function validateEmail(email: string): boolean {
  if (!email) return true; // empty is OK (field may be optional)

  const trimmed = email.trim();
  if (!trimmed) return true;

  // RFC-ish strict regex:
  // - local part: starts/ends with alphanum, allows dots/hyphens/underscores/+ in between (no consecutive dots)
  // - @ required
  // - domain: standard hostname, at least one dot, TLD 2+ chars, no trailing dot
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+\-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9\-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/.test(trimmed)
    && !/\.{2,}/.test(trimmed); // no consecutive dots anywhere
}

/** Error message for invalid email */
export const EMAIL_VALIDATION_ERROR = "Format d'email invalide (vérifiez les points, espaces, etc.)";
