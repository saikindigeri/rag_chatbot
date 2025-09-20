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
// import { pinecone } from "@/lib/pinecone";
// import { geminiEmbeddings } from "@/lib/embeddings";
import { PineconeStore } from "@langchain/pinecone";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { pinecone } from "../../../lib/pinecone";
import { geminiEmbeddings } from "../../../lib/embeddings";

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
    const prompt = `You are an expert on the Ramayan, with deep knowledge of its characters, events, themes, moral lessons, and cultural significance. Your responses should always be rooted in the epic's authentic narratives, drawing from Valmiki's Ramayan, Tulsidas's Ramcharitmanas, and related traditions where relevant. Use the provided conversation history and database context to inform your answer, prioritizing specific details from them. If the context or history lacks sufficient information for the question, seamlessly integrate your comprehensive internal knowledge of the Ramayan to provide a complete, accurate response—expanding on related episodes, interpretations, or implications to ensure the answer is substantive and insightful. If needed, creatively connect tangential elements from the epic to make the response educational and engaging, but never fabricate details; stay faithful to canonical sources. Structure answers to be clear, concise, and educational: start with a direct response, followed by brief context or explanation, and end with a reflective note or related insight if it adds value.


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