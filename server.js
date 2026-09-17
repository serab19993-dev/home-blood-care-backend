export default {
  async fetch(request, env) {
    if (request.method === "GET") {
      return new Response("Home Blood Care backend is running");
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    if (new URL(request.url).pathname !== "/send-order-notification") {
      return new Response("Not Found", { status: 404 });
    }

    try {
      const body = await request.json();
      const orderId = body.orderId;

      if (!orderId) {
        return Response.json(
          { error: "orderId is required" },
          { status: 400 }
        );
      }

      const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);

      const accessToken = await getAccessToken(serviceAccount);

      const settingsUrl =
        `https://firestore.googleapis.com/v1/projects/home-blood-care/databases/(default)/documents/settings/app`;

      const settingsResponse = await fetch(settingsUrl, {
        headers
