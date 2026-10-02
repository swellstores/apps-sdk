import { generateKeyPairSync, createHash, sign } from 'node:crypto';

// Match the proxy's P-256 key, RFC 7638 kid and ES256 JWT wire format.
export function createSigner() {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const { crv, kty, x, y } = publicKey.export({ format: 'jwk' });
  const kid = createHash('sha256').update(JSON.stringify({ crv, kty, x, y })).digest('base64url');
  const jwk = { crv, kty, x, y, kid, alg: 'ES256', use: 'sig' };
  return {
    jwk,
    token(claims = {}, header = {}) {
      const iat = Math.floor(Date.now() / 1000);
      const payload = { iss: 'https://swell.store', aud: 'app', iat, exp: iat + 60,
        store_id: 'store', app_id: 'app', installation_id: 'installation', environment_id: null,
        storefront_id: null, api_host: 'https://backend.test', admin_url: 'https://store.test',
        admin: { user_id: 'user' }, ...claims };
      const input = [JSON.stringify({ alg: 'ES256', kid, typ: 'JWT', ...header }), JSON.stringify(payload)]
        .map(value => Buffer.from(value).toString('base64url')).join('.');
      return `${input}.${sign('sha256', Buffer.from(input), { key: privateKey, dsaEncoding: 'ieee-p1363' }).toString('base64url')}`;
    },
  };
}
