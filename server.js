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
        : {
  Authorization: `Bearer ${accessToken}`
}
});

if (!settingsResponse.ok) {
  throw new Error("Could not read Firebase settings");
}

const settings = await settingsResponse.json();

const managerFcmToken =
  settings.fields?.managerFcmToken?.stringValue;

if (!managerFcmToken) {
  return Response.json(
    { error: "Manager FCM token not found" },
    { status: 400 }
  );
}

const fcmResponse = await fetch(
  "https://fcm.googleapis.com/v1/projects/home-blood-care/messages:send",
  {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: {
        token: managerFcmToken,
        notification: {
          title: "طلب جديد",
          body: `تم استلام طلب جديد رقم ${orderId}`
        },
        data: {
          orderId: String(orderId)
        }
      }
    })
  }
);

const fcmResult = await fcmResponse.text();

if (!fcmResponse.ok) {
  throw new Error(fcmResult);
}

return Response.json({
  success: true,
  message: "Notification sent"
});

} catch (error) {
  console.error("SEND_NOTIFICATION_ERROR:", error);

  return Response.json(
    {
      success: false,
      error: error.message
    },
    { status: 500 }
  );
}
}
};

async function getAccessToken(serviceAccount) {
const header = {
alg: "RS256",
typ: "JWT"
};

const now = Math.floor(Date.now() / 1000);

const payload = {
iss: serviceAccount.client_email,
scope: "https://www.googleapis.com/auth/firebase.messaging https://www.googleapis.com/auth/datastore",
aud: "https://oauth2.googleapis.com/token",
iat: now,
exp: now + 3600
};

const encodedHeader = base64url(JSON.stringify(header));
const encodedPayload = base64url(JSON.stringify(payload));

const unsignedToken =
`${encodedHeader}.${encodedPayload}`;

const privateKey = await crypto.subtle.importKey(
"pkcs8",
pemToArrayBuffer(serviceAccount.private_key),
{
name: "RSASSA-PKCS1-v1_5",
hash: "SHA-256"
},
false,
["sign"]
);

const signature = await crypto.subtle.sign(
"RSASSA-PKCS1-v1_5",
privateKey,
new TextEncoder().encode(unsignedToken)
);

const jwt =
`${unsignedToken}.${base64urlBytes(new Uint8Array(signature))}`;

const response = await fetch(
"https://oauth2.googleapis.com/token",
{
method: "POST",
headers: {
"Content-Type": "application/x-www-form-urlencoded"
},
body:
`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
}
);

const result = await response.json();

if (!response.ok) {
throw new Error(
result.error_description || "Could not get Firebase access token"
);
}

return result.access_token;
}

function pemToArrayBuffer(pem) {
const base64 = pem
.replace("-----BEGIN PRIVATE KEY-----", "")
.replace("-----END PRIVATE KEY-----", "")
.replace(/\s/g, "");

const binary = atob(base64);
const bytes = new Uint8Array(binary.length);

for (let i = 0; i < binary.length; i++) {
bytes[i] = binary.charCodeAt(i);
}

return bytes.buffer;
}

function base64url(value) {
return base64urlBytes(
new TextEncoder().encode(value)
);
}

function base64urlBytes(bytes) {
let binary = "";

for (const byte of bytes) {
binary += String.fromCharCode(byte);
}

return btoa(binary)
.replace(/\+/g, "-")
.replace(/\//g, "_")
.replace(/=+$/, "");
}
