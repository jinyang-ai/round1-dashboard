import { NextRequest, NextResponse } from 'next/server';
import { getStats, getClients, getRoleTypes } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    const filters = {
      client: searchParams.get('client') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
    };
    
    const [stats, clients, roleTypes] = await Promise.all([
      getStats(filters),
      getClients(),
      getRoleTypes(),
    ]);
    
    return NextResponse.json({
      success: true,
      stats,
      clients,
      roleTypes,
      filters,
    });
  } catch (error: any) {
    console.error('Get stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats', message: error.message },
      { status: 500 }
    );
  }
}
