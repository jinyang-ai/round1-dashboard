import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete('session');
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { error: 'Logout failed', message: error.message },
      { status: 500 }
    );
  }
}
