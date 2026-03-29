export default async function handler(req, res) {
  const GROQ_KEY = process.env.GROQ_API_KEY;

  if (req.method === 'POST') {
    const { prompt, history, globalMemory, generateTitle } = req.body;

    try {
      // 1. PRIMARY CHAT COMPLETION & EXTRACTION
      const chatResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { 
              role: "system", 
              content: `You are ATLAS V3.0, the user's authentic digital twin. 
              CORE DATA: ${globalMemory}. 
              
              DIRECTIVE: You have a perfect memory. If the user shares a personal detail, a preference, a trait, or a new rule, you MUST begin your response with 'MEM_UPDATE: [the specific detail]' followed by a newline. 
              Example: 'MEM_UPDATE: User prefers dark mode UI and hates the color red.'
              Then continue your natural conversation below that line.` 
            },
            ...history.map(m => ({
              role: m.role === 'user' ? 'user' : 'assistant',
              content: m.text
            }))
          ],
          temperature: 0.7
        })
      });

      const chatData = await chatResponse.json();
      let fullText = chatData.choices[0].message.content;
      
      // Parse out the memory update if ATLAS generated one
      let memoryUpdate = null;
      if (fullText.includes("MEM_UPDATE:")) {
        const lines = fullText.split('\n');
        const updateLine = lines.find(l => l.startsWith("MEM_UPDATE:"));
        memoryUpdate = updateLine.replace("MEM_UPDATE:", "").trim();
        // Remove the MEM_UPDATE line from the text shown to the user
        fullText = lines.filter(l => !l.startsWith("MEM_UPDATE:")).join('\n').trim();
      }

      // 2. SMART TITLE GENERATION (Only for new links)
      let chatTitle = null;
      if (generateTitle) {
        const titleRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${GROQ_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [
              { role: "system", content: "Summarize this request in exactly 2-3 words. No quotes, no punctuation." },
              { role: "user", content: prompt }
            ]
          })
        });
        const titleData = await titleRes.json();
        chatTitle = titleData.choices[0].message.content.trim();
      }

      // Send everything back to the frontend
      res.status(200).json({ 
        text: fullText, 
        title: chatTitle, 
        memoryUpdate: memoryUpdate 
      });

    } catch (e) {
      res.status(500).json({ error: "Neural Sync Failed." });
    }
  } else {
    res.status(405).json({ error: "Method not allowed" });
  }
}
