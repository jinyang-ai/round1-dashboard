import { NextRequest, NextResponse } from 'next/server';
import { getInterviews } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters = {
      client: searchParams.get('client') || undefined,
      roleType: searchParams.get('roleType') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      interviewer: searchParams.get('interviewer') || undefined,
      limit: parseInt(searchParams.get('limit') || '50'),
      offset: parseInt(searchParams.get('offset') || '0'),
    };
    
    const result = await getInterviews(filters);
    
    return NextResponse.json({
      success: true,
      data: result.data,
      count: result.count,
      filters,
    });
  } catch (error: any) {
    console.error('Get interviews error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interviews', message: error.message },
      { status: 500 }
    );
  }
}
