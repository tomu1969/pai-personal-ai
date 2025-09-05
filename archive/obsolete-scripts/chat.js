#!/usr/bin/env node

const fs = require("fs");
const readline = require("readline");
// Force load .env file, override existing environment variables
require('dotenv').config({ override: true });
const { OpenAI } = require("openai");

// Load system prompt
const systemPrompt = fs.readFileSync(
  "/Users/tomas/Desktop/ai_pbx/prompts/pai_responder.md",
  "utf8"
);

// Init OpenAI client
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Setup terminal input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

let history = [
  { role: "system", content: systemPrompt }
];

async function ask() {
  if (rl.closed) return;
  
  rl.question("> ", async (input) => {
    if (!input || input.trim() === '') {
      ask();
      return;
    }
    
    // Check for exit commands
    if (input.toLowerCase().includes('quit') || input.toLowerCase().includes('exit')) {
      console.log("Goodbye!");
      rl.close();
      return;
    }
    
    history.push({ role: "user", content: input });

    try {
      const response = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: history
      });

      const answer = response.choices[0].message.content;
      console.log("\n" + answer + "\n");

      history.push({ role: "assistant", content: answer });
    } catch (error) {
      console.log("\nError: " + error.message + "\n");
    }

    ask(); // loop
  });
}

console.log("CLI Chatbot started. Type your message below.\n");
ask();
