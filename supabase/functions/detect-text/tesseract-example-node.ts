/**
 * tesseract-example-node.ts
 *
 * A minimal Node.js example showing how to run OCR with tesseract.js.
 * This file is intended as a reference for local testing or as a basis
 * for a serverless Node deployment (Cloud Functions, Cloud Run, etc.).
 *
 * Notes:
 * - tesseract.js performs OCR in pure JavaScript but requires native
 *   binaries for best performance (or an emscripten build). For simple
 *   demos it can run in Node with npm install tesseract.js
 * - This example uses an Express server to accept image uploads as base64
 *   or an image URL. Adapt the handler to your serverless platform's API.
 */

import express from "express";
import bodyParser from "body-parser";
import fetch from "node-fetch";
import { createWorker } from "tesseract.js";

const app = express();
app.use(bodyParser.json({ limit: "10mb" }));

const worker = createWorker();

async function initWorker() {
  await worker.load();
  await worker.loadLanguage("eng");
  await worker.initialize("eng");
}

initWorker().catch((e) => {
  console.error("Failed to initialize tesseract worker:", e);
});

app.post("/detect", async (req, res) => {
  try {
    const { imageUrl, imageBase64 } = req.body as { imageUrl?: string; imageBase64?: string };

    let imageBuffer: Buffer | null = null;

    if (imageBase64) {
      // Accept data URLs or plain base64
      const base64 = imageBase64.replace(/^data:image\/[a-zA-Z]+;base64,/, "");
      imageBuffer = Buffer.from(base64, "base64");
    } else if (imageUrl) {
      const r = await fetch(imageUrl);
      if (!r.ok) throw new Error(`Failed to fetch image: ${r.status} ${r.statusText}`);
      imageBuffer = Buffer.from(await r.arrayBuffer());
    } else {
      return res.status(400).json({ error: "imageUrl or imageBase64 required" });
    }

    // Recognize text
    const { data } = await worker.recognize(imageBuffer as any);

    // data.text contains the full recognized text. data.words contains word-level results.
    return res.json({ success: true, text: data.text, words: data.words });
  } catch (error) {
    console.error("Tesseract detect error:", error);
    return res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
  console.log(`Tesseract example server listening on http://localhost:${port}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("Shutting down tesseract worker...");
  try {
    await worker.terminate();
  } catch (e) {
    // ignore
  }
  process.exit(0);
});
