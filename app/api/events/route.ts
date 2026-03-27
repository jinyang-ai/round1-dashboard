import { NextRequest } from 'next/server';
import { addSSEClient, removeSSEClient } from '../webhook/route';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Note: On Vercel serverless, SSE connections have a max duration of ~10 seconds on Hobby
// and ~60 seconds on Pro plans. For true real-time, consider Vercel's native Realtime
// or a service like Pusher/Ably.

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection message
      const sendMessage = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch (e) {
          // Stream may be closed
        }
      };
      
      sendMessage({ type: 'connected', timestamp: new Date().toISOString() });
      
      // Add this client to the broadcast list
      addSSEClient(controller);
      
      // Send heartbeat every 25 seconds to keep connection alive
      // (Vercel has timeouts, keeping under 30s is safer)
      const heartbeat = setInterval(() => {
        try {
          sendMessage({ type: 'heartbeat', timestamp: new Date().toISOString() });
        } catch (e) {
          clearInterval(heartbeat);
          removeSSEClient(controller);
        }
      }, 25000);
      
      // Cleanup on close/abort
      const cleanup = () => {
        clearInterval(heartbeat);
        removeSSEClient(controller);
        try {
          controller.close();
        } catch (e) {
          // Already closed
        }
      };
      
      request.signal.addEventListener('abort', cleanup);
    },
  });
  
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
    },
  });
}
