import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-jwt-secret-change-this'
);

export async function createSession() {
  const token = await new SignJWT({ authenticated: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
  
  return token;
}

export async function verifySession(token: string) {
  try {
    const verified = await jwtVerify(token, JWT_SECRET);
    return verified.payload.authenticated === true;
  } catch {
    return false;
  }
}

export async function getSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get('session')?.value;
  
  if (!token) {
    return false;
  }
  
  return verifySession(token);
}

export function verifyPassword(password: string) {
  return password === process.env.DASHBOARD_PASSWORD;
}
