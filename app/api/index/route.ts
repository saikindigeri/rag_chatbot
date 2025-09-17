/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { PineconeStore } from "@langchain/pinecone";
import { pinecone } from "@/lib/pinecone";
import { geminiEmbeddings } from "@/lib/embeddings";

import path from "path";

export async function POST() {
  try {
    const pdfPath = path.join(process.cwd(), "public", "ramayan.pdf");
    const loader = new PDFLoader(pdfPath);
    const docs = await loader.load();

    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    const chunks = await splitter.splitDocuments(docs);

    const index = pinecone.Index(process.env.PINECONE_INDEX_NAME!);
    await PineconeStore.fromDocuments(chunks, geminiEmbeddings, {
      pineconeIndex: index,
      maxConcurrency: 5,
    });

    return NextResponse.json({ message: "PDF indexed successfully" });
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
