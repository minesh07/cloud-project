import express from "express";
import { createServer as createViteServer } from "vite";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// Initialize S3 Client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

// API endpoint to get a pre-signed URL for S3 upload
app.get("/api/upload-url", async (req, res) => {
  const { fileName, fileType } = req.query;

  if (!fileName || !fileType) {
    return res.status(400).json({ error: "fileName and fileType are required" });
  }

  const key = `videos/${Date.now()}-${fileName}`;
  const bucketName = process.env.AWS_S3_BUCKET_NAME;

  if (!bucketName) {
    return res.status(500).json({ error: "AWS_S3_BUCKET_NAME is not configured" });
  }

  try {
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: fileType as string,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    res.json({ url, key });
  } catch (error) {
    console.error("Error generating pre-signed URL:", error);
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

// Mock database for video metadata (In a real app, use Firestore or RDS)
let videos: any[] = [];

app.get("/api/videos", (req, res) => {
  res.json(videos);
});

app.post("/api/videos", (req, res) => {
  const { title, s3Key, url, category, tags } = req.body;
  const newVideo = { 
    id: Date.now(), 
    title, 
    s3Key, 
    url, 
    category: category || "Uncategorized", 
    tags: tags || [], 
    createdAt: new Date() 
  };
  videos.push(newVideo);
  res.status(201).json(newVideo);
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
