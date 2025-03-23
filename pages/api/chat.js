import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import multer from "multer";

export const config = {
  api: {
    bodyParser: false, // Disable built-in body parser to handle file uploads
  },
};

const upload = multer({ dest: "/tmp/" });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed. Use POST." });
  }

  try {
    // Wrap multer's handling to avoid Next.js request issues
    await new Promise((resolve, reject) => {
      upload.single("file")(req, {}, (err) => {
        if (err) return reject(err);
        resolve(null);
      });
    });

    const { prompt } = req.body;

    if (!prompt || !req.file) {
      return res
        .status(400)
        .json({ error: "Both prompt and image are required." });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "API key is not configured." });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const filePath = req.file.path;

    const fileToGenerativePart = (filePath, mimeType) => ({
      inlineData: {
        data: fs.readFileSync(filePath).toString("base64"),
        mimeType,
      },
    });

    const imagePart = fileToGenerativePart(filePath, req.file.mimetype);
    const result = await model.generateContent([prompt, imagePart]);

    // Cleanup temporary file
    fs.unlinkSync(filePath);

    res.status(200).json({ answer: result.response.text() });
  } catch (error) {
    console.error("Failed to fetch answer:", error);
    res.status(500).json({ error: "Failed to fetch answer." });
  }
}
