// /* eslint-disable @typescript-eslint/no-explicit-any */
// import { NextResponse } from "next/server";
// import { pinecone } from "@/lib/pinecone";
// import { geminiEmbeddings } from "@/lib/embeddings";
// import { PineconeStore } from "@langchain/pinecone";
// import { GoogleGenerativeAI } from "@google/generative-ai";

// const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// export async function POST(req: Request) {
//   const { messages } = await req.json();
//   const userMsg = messages[messages.length - 1]?.content;

//   if (!userMsg)
//     return NextResponse.json({ error: "No message provided" }, { status: 400 });

//   try {
//     // 1. Retrieve context from Pinecone
//     const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
//     const store = await PineconeStore.fromExistingIndex(geminiEmbeddings, {
//       pineconeIndex: index,
//     });
//     const docs = await store.similaritySearch(userMsg, 4);
//     const context = docs.map((d) => d.pageContent).join("\n\n");

//     // 2. Ask Gemini with context
//     const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
//     const prompt = `Use the following context to answer. 
// If the answer isn't in the context, say "I don't know" and give answer professionally.
// Context:\n${context}\n\nQuestion: ${userMsg}`;

//     const resp = await model.generateContentStream(prompt);

//     // 3. Stream back to client
//     const stream = new ReadableStream({
//       async start(controller) {
//         const encoder = new TextEncoder();
//         for await (const chunk of resp.stream) {
//           controller.enqueue(encoder.encode(chunk.text()));
//         }
//         controller.close();
//       },
//     });

//     return new Response(stream, {
//       headers: { "Content-Type": "text/plain; charset=utf-8" },
//     });
//   } catch (err: any) {
//     console.error(err);
//     return NextResponse.json({ error: err.message }, { status: 500 });
//   }
// }
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { pinecone } from "@/lib/pinecone";
import { geminiEmbeddings } from "@/lib/embeddings";
import { PineconeStore } from "@langchain/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function transformQuery(question: string, messages: { role: string; content: string }[]): Promise<string> {
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const historyText = messages.map((msg) => `${msg.role}: ${msg.content}`).join("\n");

  const prompt = `You are a query rewriting expert. Based on the provided chat history, rephrase the latest user question into a complete, standalone question that can be understood without the chat history. If the question is vague (e.g., "tell me more"), infer the topic from the history and rewrite it to be specific. Output only the rewritten question.

Conversation History:
${historyText}

Latest Question: ${question}`;

  const response = await model.generateContent(prompt);
  return response.response.text();
}

export async function POST(req: Request) {
  const { messages } = await req.json();
  const userMsg = messages[messages.length - 1]?.content;

  if (!userMsg) {
    return NextResponse.json({ error: "No message provided" }, { status: 400 });
  }

  try {
    // 1. Rewrite the user query
    const rewrittenQuery = await transformQuery(userMsg, messages);

    // 2. Retrieve context from Pinecone
    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
    const store = await PineconeStore.fromExistingIndex(geminiEmbeddings, {
      pineconeIndex: index,
    });
    const docs = await store.similaritySearch(rewrittenQuery, 4);
    const context = docs.map((d) => d.pageContent).filter((text) => text).join("\n\n");

    // 3. Format conversation history
    const historyText = messages.slice(-10).map((msg: { role: any; content: any; }) => `${msg.role}: ${msg.content}`).join("\n"); // Limit to last 10 messages

    // 4. Generate response from Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `You are a Data Structure and Algorithm expert. Use the provided context and conversation history to answer the user's question. If the context doesn't contain the answer, use your general knowledge to provide a relevant and accurate response, but indicate that the information is not from the provided context. For vague questions like "tell me more," refer to the conversation history to understand the topic. Keep answers clear, concise, and educational.

Conversation History:
${historyText}

Context from database:
${context}

Question: ${rewrittenQuery}`;

    const resp = await model.generateContentStream(prompt);

    // 5. Stream back to client
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        for await (const chunk of resp.stream) {
          const text = chunk.text();
          controller.enqueue(encoder.encode(text));
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