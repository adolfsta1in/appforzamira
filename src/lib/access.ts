export type AccessLevel = 'full' | 'registry';

export const ACCESS_COOKIE_NAME = 'app_access';

const encoder = new TextEncoder();

function getSigningSecret() {
  return (
    process.env.AUTH_COOKIE_SECRET ||
    process.env.FULL_ACCESS_PASSWORD ||
    process.env.REGISTRY_ACCESS_PASSWORD ||
    'local-dev-access-secret'
  );
}

async function getSignature(level: AccessLevel) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(getSigningSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(level));
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export async function createAccessCookieValue(level: AccessLevel) {
  return `${level}.${await getSignature(level)}`;
}

export async function readAccessCookieValue(value?: string | null): Promise<AccessLevel | null> {
  if (!value) return null;

  const [level, signature] = value.split('.');
  if ((level !== 'full' && level !== 'registry') || !signature) return null;

  const expectedSignature = await getSignature(level);
  return signature === expectedSignature ? level : null;
}
