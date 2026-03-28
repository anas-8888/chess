const DEFAULT_AVATAR_PATTERNS = ['/img/default-avatar.png', '/placeholder.svg'];

export const hasCustomAvatar = (avatarUrl?: string | null): boolean => {
  if (!avatarUrl || typeof avatarUrl !== 'string') return false;
  const normalized = avatarUrl.trim().toLowerCase();
  if (!normalized) return false;

  return !DEFAULT_AVATAR_PATTERNS.some(pattern => normalized.includes(pattern));
};

export const normalizeAvatarUrl = (avatarUrl?: string | null): string | undefined => {
  if (!avatarUrl || typeof avatarUrl !== 'string') return undefined;
  const trimmed = avatarUrl.trim();
  if (!trimmed) return undefined;

  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }

  let normalized = trimmed.replace(/\\/g, '/');
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }

  // Legacy records may store "/storage/thumbnails/..."; static public path is "/thumbnails/..."
  if (normalized.startsWith('/storage/thumbnails/')) {
    normalized = normalized.replace('/storage', '');
  }

  return normalized;
};

export const getInitialsFromName = (name?: string | null): string => {
  if (!name || typeof name !== 'string') return '?';

  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) return '?';

  return parts
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase() || '')
    .join('');
};
