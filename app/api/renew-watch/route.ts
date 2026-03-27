import { NextRequest, NextResponse } from 'next/server';
import { setupCalendarWatch } from '@/lib/calendar';

export async function POST(request: NextRequest) {
  try {
    // Check for authorization
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.JWT_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const calendarId = process.env.GOOGLE_CALENDAR_ID || 'round1@grapevine.in';
    const webhookUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/webhook`;
    
    console.log('Setting up calendar watch...');
    const watchInfo = await setupCalendarWatch(calendarId, webhookUrl);
    console.log('Watch setup complete:', watchInfo);
    
    return NextResponse.json({
      success: true,
      ...watchInfo,
    });
  } catch (error: any) {
    console.error('Renew watch error:', error);
    return NextResponse.json(
      { error: 'Failed to renew watch', message: error.message },
      { status: 500 }
    );
  }
}
