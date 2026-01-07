import { z } from "zod";
import { LightMission } from "./LightMission.js";
import { memoryStore } from "../../services/memoryService.js";
import { GeminiAdapter } from "../geminiAdapter.js";
import { config } from "../../config/env.js";

const saveConversationNoteMission = new LightMission({
  name: "save_conversation_note",
  group: "memory",
  description: "Save a brief note about a decision or plan (5-20 words)",
  missionInfo: "When user makes decisions/plans/requests",
  behavior: ["Write concisely (5-20 words for notes)."],
  schema: z.object({
    note: z.string().describe("Brief note about the conversation (5-20 words)"),
    englishNote: z.string().optional().describe("English translation of the note (preferred if source is not English)"),
    importance: z.number().min(1).max(10).optional().default(5).describe("Importance level 1-10 (default: 5)"),
  }),
  execute: async ({ userId, args }) => {
    const { note, englishNote, importance = 5 } = args;
    try {
      const metadata = { source: "llm_tool" };
      let noteToSave = note;

      // Prefer the provided English translation when available
      if (englishNote && englishNote.trim()) {
        noteToSave = englishNote.trim();
        metadata.originalText = note;
        metadata.translated = true;
        if (/[\u0590-\u05FF]/.test(note)) metadata.originalLanguage = "he";
      } else {
        // If the note contains non-ASCII characters, attempt to auto-translate via Gemini if available
        if (/[^\u0000-\u007F]/.test(note)) {
          if (config.geminiApiKey) {
            try {
              const adapter = new GeminiAdapter(config.geminiApiKey, config.geminiModel);
              const messages = [
                {
                  role: "system",
                  content:
                    "You are a concise translator. Translate the following text into concise English (5-20 words). Preserve date expressions (do NOT convert them to ISO). Reply ONLY with the translated text.",
                },
                { role: "user", content: note },
              ];
              const response = await adapter.generateContent(messages);
              const extracted = adapter.extractResponse(response);
              if (extracted && extracted.type === "text" && extracted.text) {
                noteToSave = extracted.text.trim().split(/\n/)[0];
                metadata.originalText = note;
                metadata.translated = true;
                if (/[\u0590-\u05FF]/.test(note)) metadata.originalLanguage = "he";
              } else {
                metadata.needsTranslation = true;
              }
            } catch (err) {
              metadata.needsTranslation = true;
            }
          } else {
            metadata.needsTranslation = true;
          }
        }
      }

      await memoryStore.saveConversationMemory(userId, noteToSave, "conversation", importance, {
        source: "llm_tool",
        metadata,
      });

      return `ok=true\nmsg="Saved note: ${noteToSave}"\nimp=${importance}`;
    } catch (error) {
      return `ok=false\nerr="${error.message}"`;
    }
  },
});

export default saveConversationNoteMission;
