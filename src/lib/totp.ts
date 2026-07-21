import * as OTPAuth from 'otpauth';

/**
 * TOTP configuration for KSAS QR rotation.
 *
 * - Period: 5s — matches the QR display refresh interval in LiveSession.tsx.
 * - Window: 2 — accepts tokens from the current period and ±2 periods ahead/behind
 *   (±10s drift tolerance, ~25s total validity). This is intentionally tight: a QR
 *   code screenshot taken at period N is only valid for ~25 s, not 30 s like a
 *   standard TOTP setup with period=30.
 */
const TOTP_PERIOD = 5;
const TOTP_WINDOW = 2;

export function generateSessionTOTPSecret(): string {
  const secret = new OTPAuth.Secret({ size: 20 });
  return secret.base32;
}

export function getCurrentTOTP(secretBase32: string): string {
  if (!secretBase32) {
    console.error('[TOTP] Cannot generate token: missing secret');
    return '';
  }
  const totp = new OTPAuth.TOTP({
    algorithm: 'SHA1',
    digits: 6,
    period: TOTP_PERIOD,
    secret: OTPAuth.Secret.fromBase32(secretBase32),
  });
  return totp.generate();
}

export function validateTOTP(secretBase32: string, token: string): boolean {
  if (!secretBase32 || !token) {
    console.error('[TOTP] Validation failed: missing secret or token', {
      hasSecret: !!secretBase32,
      hasToken: !!token,
    });
    return false;
  }

  const tokenStr = String(token).trim();
  if (tokenStr.length !== 6 || !/^\d{6}$/.test(tokenStr)) {
    console.error('[TOTP] Validation failed: token must be exactly 6 digits', {
      received: tokenStr,
    });
    return false;
  }

  let totp: OTPAuth.TOTP;
  try {
    totp = new OTPAuth.TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: TOTP_PERIOD,
      secret: OTPAuth.Secret.fromBase32(secretBase32),
    });
  } catch (err) {
    console.error('[TOTP] Failed to create TOTP instance', {
      error: err instanceof Error ? err.message : err,
    });
    return false;
  }

  const delta = totp.validate({ token: tokenStr, window: TOTP_WINDOW });

  if (delta !== null) {
    return true;
  }

  // Diagnostics on failure (only logged, never thrown)
  const now = Date.now();
  const currentStep = Math.floor(now / (TOTP_PERIOD * 1000));
  const expectedTokens: string[] = [];
  for (let i = -TOTP_WINDOW; i <= TOTP_WINDOW; i++) {
    const stepTimestamp = (currentStep + i) * TOTP_PERIOD * 1000;
    expectedTokens.push(totp.generate({ timestamp: stepTimestamp }));
  }

  console.error('[TOTP] Validation FAILED', {
    received: tokenStr,
    currentStep,
    window: TOTP_WINDOW,
    period: TOTP_PERIOD,
    expectedTokens,
    secretPrefix: secretBase32.substring(0, 4) + '...',
  });

  return false;
}
