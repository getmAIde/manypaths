import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const RELIGIONS = [
  "Christianity",
  "Judaism",
  "Islam",
  "Buddhism",
  "Hinduism",
  "Taoism",
  "Sikhism",
];

const TOPIC = process.argv[2] || "forgiveness";

async function researchTopic(topic) {
  console.log(`\n🌉 BridgeMAIde Research Engine`);
  console.log(`📖 Topic: ${topic}\n`);

  const prompt = `You are a respectful, balanced religious scholar. Research how each of the following religions approaches the topic of "${topic}".

For each religion provide:
1. Core belief or teaching on this topic
2. Key scripture or text reference
3. How it is practiced or expressed
4. One surprising or lesser known insight

Religions to cover: ${RELIGIONS.join(", ")}

Then add a final section called COMMON GROUND that identifies:
- What all or most traditions share on this topic
- The most surprising connection between two traditions
- A one sentence bridge statement that unites them all

Rules:
- Be scrupulously balanced — no tradition is favored
- Always cite actual scripture or authoritative text
- Use plain accessible language — not academic jargon
- Tone is curious, warm and respectful throughout
- Format each religion as a clear section with headers`;

  const chunks = [];

  const stream = client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    messages: [{ role: "user", content: prompt }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      process.stdout.write(event.delta.text);
      chunks.push(event.delta.text);
    }
  }

  return chunks.join("");
}

async function main() {
  const research = await researchTopic(TOPIC);

  const outputDir = "/Users/macbook/getmAIde/bridgemaide/output";
  const filename = `${outputDir}/${TOPIC.replace(/\s+/g, "_")}_research.md`;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(filename, research);
  console.log(`\n\n✅ Saved to ${filename}`);
  console.log(`📓 Ready to upload to NotebookLM`);
}

main();
