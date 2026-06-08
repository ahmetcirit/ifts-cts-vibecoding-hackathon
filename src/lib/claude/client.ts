import Groq from "groq-sdk";

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

export const MODEL = "llama-3.3-70b-versatile";
export const MAX_TOKENS = 4096;
