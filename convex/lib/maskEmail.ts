/**
 * Mask an email for display, e.g. `in***********ail.com`
 */
export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf("@");
  if (atIndex <= 0) return "********";

  const local = trimmed.slice(0, atIndex);
  const domain = trimmed.slice(atIndex + 1);
  if (!domain) return "********";

  const localVisible = Math.min(2, local.length);
  const localMasked =
    local.length <= localVisible
      ? local
      : `${local.slice(0, localVisible)}${"*".repeat(Math.max(3, local.length - localVisible))}`;

  const dotIndex = domain.lastIndexOf(".");
  if (dotIndex <= 0) {
    return `${localMasked}@${"*".repeat(Math.max(3, domain.length))}`;
  }

  const domainName = domain.slice(0, dotIndex);
  const tld = domain.slice(dotIndex);
  const domainVisible = Math.min(2, domainName.length);
  const domainMasked =
    domainName.length <= domainVisible
      ? domainName
      : `${domainName.slice(0, domainVisible)}${"*".repeat(Math.max(3, domainName.length - domainVisible))}`;

  return `${localMasked}@${domainMasked}${tld}`;
}

/**
 * Normalizes an email string by extracting the bare email address
 * from standard formats (e.g. "Kurt Libby <kurt@magicmakrs.com>" -> "kurt@magicmakrs.com").
 * Returns trimmed lowercase string.
 */
export function extractCleanEmail(raw?: string | null): string {
  if (!raw) return "";
  const match = raw.match(/<([^>]+)>/);
  const email = match ? match[1] : raw;
  return email.trim().toLowerCase();
}
