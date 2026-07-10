import { supabase } from './supabase';

export async function trackEvent(
  eventName: string,
  roomId?: string,
  userId?: string,
  payload?: any
) {
  try {
    await supabase.from('mitimiti_metrics').insert({
      event_name: eventName,
      room_id: roomId || null,
      user_id: userId || null,
      payload: payload || {},
      client_ts: Date.now()
    });
  } catch (err) {
    console.error('Error tracking event', err);
  }
}
