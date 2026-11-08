// Local stand-in for the Gemini generateContent endpoint, used only by the @ai-mock e2e specs
// (the second app server points GEMINI_BASE_URL here). Returns schema-valid JSON per action.
import http from "node:http";

const port = Number(process.env.MOCK_GEMINI_PORT ?? 3999);

function answer(prompt) {
  if (prompt.includes('"subtasks"')) return { subtasks: [{ title: "Mock AI: draft outline", effort: 2 }, { title: "Mock AI: review draft", effort: 3 }] };
  if (prompt.includes('"markdown"')) return { markdown: "Mock AI summary: the project is moving; keep an eye on overdue work." };
  if (prompt.includes('"narrative"')) return { narrative: "Mock AI risk narrative.", actions: ["Review overdue work", "Unblock blocked tasks", "Rebalance workload"] };
  if (prompt.includes('"milestones"')) return { milestones: [{ name: "Mock milestone", dueOffsetDays: 7, tasks: [{ title: "Mock task", description: "", priority: "medium", effort: 2 }] }] };
  return { ranked: [] };
}

http
  .createServer((req, res) => {
    if (req.method !== "POST") {
      res.writeHead(200, { "content-type": "text/plain" }).end("mock gemini ok");
      return;
    }
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      let prompt = "";
      try {
        prompt = JSON.parse(body).contents?.[0]?.parts?.[0]?.text ?? "";
      } catch {
        /* malformed request → empty prompt */
      }
      const text = JSON.stringify(answer(prompt));
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }], usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 34 } }));
    });
  })
  .listen(port, "127.0.0.1", () => console.log(`mock gemini on ${port}`));
