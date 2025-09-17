/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { pinecone } from "@/lib/pinecone";
import { geminiEmbeddings } from "@/lib/embeddings";
import { PineconeStore } from "@langchain/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(req: Request) {
  const { messages } = await req.json();
  const userMsg = messages[messages.length - 1]?.content;

  if (!userMsg)
    return NextResponse.json({ error: "No message provided" }, { status: 400 });

  try {
    // 1. Retrieve context from Pinecone
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
    const store = await PineconeStore.fromExistingIndex(geminiEmbeddings, {
      pineconeIndex: index,
    });
    const docs = await store.similaritySearch(userMsg, 4);
    const context = docs.map((d) => d.pageContent).join("\n\n");

    // 2. Ask Gemini with context
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Use the following context to answer. 
If the answer isn't in the context, say "I don't know" and give answer professionally.
Context:\n${context}\n\nQuestion: ${userMsg}`;

    const resp = await model.generateContentStream(prompt);

    // 3. Stream back to client
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        for await (const chunk of resp.stream) {
          controller.enqueue(encoder.encode(chunk.text()));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
