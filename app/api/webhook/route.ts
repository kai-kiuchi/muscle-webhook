import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const LINE_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN!;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const events = body.events || [];

    for (const event of events) {
      if (event.type === 'message' && event.message.type === 'image') {
        const userId = event.source.userId;
        const messageId = event.message.id;
        const replyToken = event.replyToken;

        // LINEから画像データ取得
        const imageResponse = await axios.get(
          `https://api-data.line.me/v2/bot/message/${messageId}/content`,
          {
            headers: { Authorization: `Bearer ${LINE_TOKEN}` },
            responseType: 'arraybuffer',
          }
        );

        const timestamp = Date.now();
        const fileName = `${userId}/${timestamp}.jpg`;

        // Supabase Storageに保存
        const { error: uploadError } = await supabase.storage
          .from('muscle-photos')
          .upload(fileName, imageResponse.data, {
            contentType: 'image/jpeg',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('muscle-photos')
          .getPublicUrl(fileName);

        // データベースに記録
        await supabase.from('muscle_records').insert({
          user_id: userId,
          image_url: urlData.publicUrl,
          record_date: new Date().toISOString().split('T')[0],
        });

        // 返信
        await axios.post(
          'https://api.line.me/v2/bot/message/reply',
          {
            replyToken,
            messages: [{ type: 'text', text: '💪 筋トレ写真を保存しました！\nこれからも毎日送って記録続けよう！' }],
          },
          { headers: { Authorization: `Bearer ${LINE_TOKEN}` } }
        );
      }
    }

    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Error:', error);
    return new Response('Error', { status: 500 });
  }
}