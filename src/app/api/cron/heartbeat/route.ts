import { createSupabaseClient } from '@/lib/db/supabaseClient';

export async function GET(request: Request) {
  // Security Guardrail: Ensure the request comes from an authorized cron caller
  const cronSecret = request.headers.get('Authorization');
  if (cronSecret !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const db = createSupabaseClient();
    
    // Perform a highly optimized, lightweight read query (fetch 1 row from analyses)
    const { error } = await db.from('analyses').select('id').range(0, 0).execute();

    if (error) {
      return new Response(
        JSON.stringify({ status: 'error', message: error.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ status: 'ok', message: 'Database heartbeat successful' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ status: 'error', message: msg }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
