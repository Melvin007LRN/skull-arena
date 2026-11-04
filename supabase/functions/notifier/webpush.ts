// Envoi de notifications Web Push (RFC 8291 « aes128gcm » + signature VAPID RFC 8292), avec WebCrypto uniquement.
const enc = new TextEncoder();

export function b64url(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
export function deb64url(s: string): Uint8Array {
  const t = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4);
  const bin = atob(t);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
async function hmac(cle: Uint8Array, donnees: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', cle, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, donnees));
}

export interface Vapid { x: string; y: string; d: string; public: string; sujet: string }
export interface Abonnement { endpoint: string; p256dh: string; auth: string }

/** Jeton VAPID (JWT ES256) pour le service de notifications du navigateur. */
async function jetonVapid(endpoint: string, v: Vapid): Promise<string> {
  const aud = new URL(endpoint).origin;
  const entete = b64url(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const corps = b64url(enc.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: v.sujet })));
  const cle = await crypto.subtle.importKey('jwk', { kty: 'EC', crv: 'P-256', x: v.x, y: v.y, d: v.d, ext: true },
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, cle, enc.encode(`${entete}.${corps}`));
  return `${entete}.${corps}.${b64url(sig)}`;
}

/** Chiffre le message pour un abonnement (contenu « aes128gcm »). */
export async function chiffrer(message: Uint8Array, ab: Abonnement, fixe?: { paire: CryptoKeyPair; sel: Uint8Array }): Promise<Uint8Array> {
  const uaPublic = deb64url(ab.p256dh);
  const secretAuth = deb64url(ab.auth);
  const paire = fixe?.paire ?? await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']) as CryptoKeyPair;
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', paire.publicKey));
  const cleUa = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const secretEcdh = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: cleUa }, paire.privateKey, 256));
  // IKM = HKDF(auth, ecdh, "WebPush: info\0" || ua_public || as_public, 32)
  const prkCle = await hmac(secretAuth, secretEcdh);
  const ikm = (await hmac(prkCle, concat(enc.encode('WebPush: info\0'), uaPublic, asPublic, new Uint8Array([1])))).slice(0, 32);
  const sel = fixe?.sel ?? crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmac(sel, ikm);
  const cek = (await hmac(prk, concat(enc.encode('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(enc.encode('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);
  const cleAes = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const chiffre = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, cleAes, concat(message, new Uint8Array([2]))));
  const rs = new Uint8Array([0, 0, 0x10, 0]); // 4096
  return concat(sel, rs, new Uint8Array([asPublic.length]), asPublic, chiffre);
}

/** Envoie une notification. Renvoie le code HTTP du service (201 = envoyée, 404/410 = abonnement expiré). */
export async function envoyer(ab: Abonnement, donnees: unknown, v: Vapid): Promise<number> {
  const corps = await chiffrer(enc.encode(JSON.stringify(donnees)), ab);
  const jeton = await jetonVapid(ab.endpoint, v);
  const r = await fetch(ab.endpoint, {
    method: 'POST',
    headers: {
      TTL: '86400', Urgency: 'high', 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream',
      Authorization: `vapid t=${jeton}, k=${v.public}`,
    },
    body: corps,
  });
  await r.body?.cancel();
  return r.status;
}
