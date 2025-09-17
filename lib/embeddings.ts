// lib/embeddings.ts
import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

export const geminiEmbeddings = new GoogleGenerativeAIEmbeddings({
  apiKey: process.env.GEMINI_API_KEY!,
  model: "text-embedding-004",
});
