// Fix candidate name parsing - extract from "CandidateName <> Interviewer" pattern
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://myoxtbrgeudmsnjenmpb.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im15b3h0YnJnZXVkbXNuamVubXBiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDU5MzMxOSwiZXhwIjoyMDkwMTY5MzE5fQ.sRxtOQbhSdNK2EhxwtcNr7_SU3aYqRMSLVPT9o4yzDk';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function extractCandidateName(title) {
  if (!title) return null;
  
  // Pattern 1: "Name <> Something" - name before <>
  const arrowMatch = title.match(/^(?:Intro\s*[Cc]hat:\s*)?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s*(?:\([^)]+\))?\s*<>/);
  if (arrowMatch) {
    return arrowMatch[1].trim();
  }
  
  // Pattern 2: "Something Interview (Name)" - name in parentheses at end
  const parenMatch = title.match(/Interview\s*\(([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\)\s*$/);
  if (parenMatch) {
    return parenMatch[1].trim();
  }
  
  // Pattern 3: "Something - Round X (Name)" 
  const roundMatch = title.match(/(?:R\d|Round\s*\d)[^(]*\(([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\)/i);
  if (roundMatch) {
    return roundMatch[1].trim();
  }

  // Pattern 4: "Name <> Company RoleName"
  const simpleArrow = title.match(/^([A-Z][a-z]+)\s*<>/);
  if (simpleArrow) {
    return simpleArrow[1].trim();
  }
  
  return null;
}

async function fixCandidateNames() {
  console.log('Fetching interviews...');
  
  const { data: interviews, error } = await supabase
    .from('interviews')
    .select('id, title, candidate_name')
    .order('start_time', { ascending: false });
  
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(`Found ${interviews.length} interviews`);
  
  let updated = 0;
  let examples = [];
  
  for (const interview of interviews) {
    const newName = extractCandidateName(interview.title);
    
    if (newName && newName !== interview.candidate_name) {
      const { error: updateError } = await supabase
        .from('interviews')
        .update({ candidate_name: newName })
        .eq('id', interview.id);
      
      if (!updateError) {
        updated++;
        if (examples.length < 10) {
          examples.push({
            title: interview.title,
            old: interview.candidate_name,
            new: newName
          });
        }
      }
    }
  }
  
  console.log(`\nUpdated ${updated} candidate names\n`);
  console.log('Examples:');
  examples.forEach(e => {
    console.log(`  "${e.title}"`);
    console.log(`    Old: ${e.old || 'null'} → New: ${e.new}`);
  });
}

fixCandidateNames().catch(console.error);
