import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

async function callGemini(prompt: string): Promise<string> {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0,
          maxOutputTokens: 8000,
          responseMimeType: 'application/json',
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Gemini API error: ${response.status} - ${err}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

function extractJSON(text: string): any[] {
  // Try direct parse first
  try {
    return JSON.parse(text);
  } catch {}
  
  // Remove markdown code blocks
  let cleaned = text.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
  
  // Find array brackets
  const start = cleaned.indexOf('[');
  const end = cleaned.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.slice(start, end + 1);
  }
  
  try {
    return JSON.parse(cleaned);
  } catch {}
  
  // Try to fix common issues
  cleaned = cleaned
    .replace(/,\s*]/g, ']')  // trailing commas
    .replace(/,\s*}/g, '}')
    .replace(/'/g, '"')       // single quotes
    .replace(/(\w+):/g, '"$1":'); // unquoted keys
  
  return JSON.parse(cleaned);
}

export async function POST(request: NextRequest) {
  if (!GEMINI_API_KEY) {
    return NextResponse.json(
      { error: 'GEMINI_API_KEY not configured' },
      { status: 500 }
    );
  }

  try {
    // Fetch interviews that need parsing
    const { data: interviews, error } = await supabaseAdmin
      .from('interviews')
      .select('id, title, client, role_type, candidate_name')
      .order('start_time', { ascending: false });

    if (error) throw error;
    if (!interviews || interviews.length === 0) {
      return NextResponse.json({ success: true, parsed: 0 });
    }

    // Filter to ones missing data
    const needsParsing = interviews.filter(i => !i.client || !i.candidate_name || !i.role_type);
    
    if (needsParsing.length === 0) {
      return NextResponse.json({ success: true, parsed: 0, message: 'All interviews already parsed' });
    }

    console.log(`Parsing ${needsParsing.length} interviews with Gemini...`);

    // Batch process (15 at a time for better JSON reliability)
    const batchSize = 15;
    let totalParsed = 0;
    const maxBatches = 15; // Process more batches

    for (let b = 0; b < Math.min(Math.ceil(needsParsing.length / batchSize), maxBatches); b++) {
      const batch = needsParsing.slice(b * batchSize, (b + 1) * batchSize);
      const titlesList = batch.map((int, idx) => `${idx + 1}. ${int.title}`).join('\n');

      const prompt = `Parse these interview meeting titles. Extract client (hiring company), candidate (person interviewed), role (job title).

${titlesList}

Known companies: Sarvam AI, Superliving AI, Waterlabs AI, CodeRabbit, Metaforms, TrustAnchor, Auquan, ChronicleHQ, TrueFoundry, Trupeer AI, Shaadi.com, People Group, Zilo, Zoop, Fam, Enterpret, Rebel Foods, Kiagentic

Pattern hints:
- "Name <> Person" = Name is candidate
- "Company Interview (Name)" = Name is candidate

Return JSON array: [{"i":1,"client":"Company","candidate":"Name","role":"Role"},...]
Use null if unknown.`;

      try {
        const response = await callGemini(prompt);
        const parsed = extractJSON(response);

        for (const item of parsed) {
          const interview = batch[item.i - 1];
          if (!interview) continue;

          const updates: Record<string, string> = {};
          if (item.client && !interview.client) updates.client = item.client;
          if (item.candidate && !interview.candidate_name) updates.candidate_name = item.candidate;
          if (item.role && !interview.role_type) updates.role_type = item.role;

          if (Object.keys(updates).length > 0) {
            const { error: updateError } = await supabaseAdmin
              .from('interviews')
              .update(updates)
              .eq('id', interview.id);
            
            if (!updateError) totalParsed++;
          }
        }
        
        console.log(`Batch ${b + 1}: parsed ${parsed.length} items`);
      } catch (parseError: any) {
        console.error(`Batch ${b + 1} error:`, parseError.message);
      }
    }

    return NextResponse.json({
      success: true,
      total: needsParsing.length,
      parsed: totalParsed,
    });
  } catch (error: any) {
    console.error('Parse error:', error);
    return NextResponse.json(
      { error: 'Parse failed', message: error.message },
      { status: 500 }
    );
  }
}
