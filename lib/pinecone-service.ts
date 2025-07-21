import { Pinecone } from '@pinecone-database/pinecone';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const pc = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY || ''
})

const assistant = pc.Assistant('realtime-tip');

export const uploadFile = async (path: string) => {
  const uploadResponse = await assistant.uploadFile({ path });
  return uploadResponse;
}

export const deleteFile = async (fileId: string) => {
  const deleteResponse = await assistant.deleteFile(fileId);
  return deleteResponse;
}

export const chat = async (systemPrompt: string, messages: ChatMessage[]) => {
  const recentMessages = messages.slice(-15);
  
  const chatResponse = await assistant.chat({
    messages: [
      {
        role: 'system',
        content: systemPrompt,
      },
      ...recentMessages.map((message: ChatMessage) => ({
        role: message.role,
        content: message.content,
      })),
    ],
    model: 'gpt-4.1',
    jsonResponse: true
  });
  return chatResponse;
}