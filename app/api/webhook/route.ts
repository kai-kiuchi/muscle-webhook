import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

export async function POST(request: Request) {
  console.log('=== Webhook received at', new Date().toISOString(), '===');

  try {
    const body = await request.json();
    console.log('Received events count:', body.events?.length || 0);

    const events = body.events || [];

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'image') {
        const userId = event.source.userId;
        const messageId = event.message.id;
        const replyToken = event.replyToken;

        const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
        if (!lineToken) {
          console.error('CRITICAL ERROR: LINE_CHANNEL_ACCESS_TOKEN is missing in environment variables');
          return new Response('Server configuration error', { status: 500 });
        }

        console.log(`Processing image for user: ${userId}`);

        // LINEから画像を取得
        const imageResponse = await axios.get(
          `https://api-data.line.me/v2/bot/message/${messageId}/content`,
          {
            headers: { Authorization: `Bearer ${lineToken}` },
            responseType: 'arraybuffer',
          }
        );

        const timestamp = Date.now();
        const fileName = `${userId}/${timestamp}.jpg`;

        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_ANON_KEY!
        );

        // Supabase Storageにアップロード
        const { error: uploadError } = await supabase.storage
          .from('muscle-photos')
          .upload(fileName, imageResponse.data, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) {
          console.error('Upload error:', uploadError);
          throw uploadError;
        }

        const { data: urlData } = supabase.storage
          .from('muscle-photos')
          .getPublicUrl(fileName);

        // データベースに保存
        await supabase.from('muscle_records').insert({
          user_id: userId,
          image_url: urlData.publicUrl,
          record_date: new Date().toISOString().split('T')[0],
        });

        console.log('Successfully saved image for user:', userId);

        // LINEに返信
        await axios.post(
          'https://api.line.me/v2/bot/message/reply',
          {
            replyToken,
            messages: [{ type: 'text', text: '💪 筋トレ写真を保存しました！' }],
          },
          { headers: { Authorization: `Bearer ${lineToken}` } }
        );
      }
    }

    return new Response('OK', { status: 200 });
  } catch (error: any) {
    console.error('Webhook Error:', error.message || error);
    return new Response('Internal Server Error', { status: 500 });
  }
}