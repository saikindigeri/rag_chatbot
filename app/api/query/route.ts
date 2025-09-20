/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server';
import { pinecone } from '@/lib/pinecone';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { PineconeStore } from '@langchain/pinecone';

export async function POST(req: Request) {
  const { question } = await req.json();

  if (!question) {
    return NextResponse.json({ error: 'No question provided' }, { status: 400 });
  }

  try {
    const embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GEMINI_API_KEY!,
      model: 'text-embedding-004',
    });

    const pineconeIndex = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
    const vectorStore = await PineconeStore.fromExistingIndex(embeddings, {
      pineconeIndex,
    });

    const results = await vectorStore.similaritySearch(question, 4);
    return NextResponse.json({ results });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
