const express = require("express");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());

const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

app.get("/", (req, res) => {
  res.send("Home Blood Care backend is running");
});

app.post("/send-order-notification", async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: "orderId is required" });
    }

    const settingsDoc = await db.collection("settings").doc("app").get();
    const managerFcmToken = settingsDoc.data()?.managerFcmToken;

    if (!managerFcmToken) {
      return res.status(400).json({ error: "Manager FCM token not found" });
    }

    const message = {
      token: managerFcmToken,
      notification: {
        title: "طلب جديد",
        body: `تم استلام طلب جديد رقم ${orderId}`
      },
      data: {
        orderId: String(orderId)
      }
    };

    await admin.messaging().send(message);

    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
