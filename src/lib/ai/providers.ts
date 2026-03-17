import { createOpenAI } from "@ai-sdk/openai";
import { createOllama } from "ollama-ai-provider-v2";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { resolveApiKey } from "@/lib/api-key-resolver";

export type ProviderType = "openai" | "ollama" | "deepseek" | "neuroapi";

export async function getModel(
  provider: ProviderType,
  modelName: string,
  userId?: string,
) {
  if (provider === "openai") {
    const apiKey = await resolveApiKey(userId, "openai");
    if (!apiKey) throw new Error("OpenAI API key not configured");
    const openai = createOpenAI({ apiKey });
    return openai(modelName);
  }

  if (provider === "deepseek") {
    const apiKey = await resolveApiKey(userId, "deepseek");
    if (!apiKey) throw new Error("DeepSeek API key not configured");
    const deepseek = createDeepSeek({ apiKey });
    return deepseek(modelName);
  }

  if (provider === "neuroapi") {
    const apiKey = await resolveApiKey(userId, "neuroapi");
    if (!apiKey) throw new Error("NeuroAPI key not configured");
    const neuroapi = createOpenAI({
      apiKey,
      baseURL: "https://neuroapi.host/v1",
    });
    return neuroapi(modelName);
  }

  const baseURL = await resolveApiKey(userId, "ollama");
  const ollama = createOllama({
    baseURL: (baseURL || "http://127.0.0.1:11434") + "/api",
  });
  return ollama(modelName);
}
