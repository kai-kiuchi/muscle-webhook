import axios from 'axios';

export async function POST(request: Request) {
  console.log("Webhook called at", new Date().toISOString());

  try {
    const body = await request.json();
    console.log("Received body:", JSON.stringify(body).slice(0, 200) + "...");

    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    console.log("LINE_TOKEN exists?", !!lineToken);

    if (!lineToken) {
      console.error("LINE_TOKEN is missing!");
      return new Response("Token missing", { status: 500 });
    }

    // 検証リクエストの場合も200を返す
    return new Response("OK", { status: 200 });
  } catch (error: any) {
    console.error("Webhook error:", error.message);
    return new Response("Error", { status: 500 });
  }
}