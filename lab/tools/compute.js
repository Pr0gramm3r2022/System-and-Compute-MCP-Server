// lab/tools/compute.js
import { z } from 'zod';

/**
 * Registers linear algebra and calculation tools with the MCP Server instance.
 * @param {McpServer} server - The active Model Context Protocol server instance.
 */
export function registerComputeTools(server) {
  
  // ── Tool 1: Add Two Numbers ────────────────────────────────────────
  server.tool(
    "add",
    "Adds two numbers together (a + b).",
    // 🛡️ The Crucial Fix: This MUST be a plain JavaScript object shape.
    // The SDK automatically calls z.object() on this wrapper under the hood.
    {
      a: z.number().describe("The first numeric value"),
      b: z.number().describe("The second numeric value")
    },
    async ({ a, b }) => {
      try {
        const sum = a + b;
        return {
          content: [{ type: "text", text: `Result: ${sum}` }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Calculation error: ${error.message}` }]
        };
      }
    }
  );

  // ── Tool 2: Multiply Two Numbers ───────────────────────────────────
  server.tool(
    "multiply",
    "Multiplies two numbers together (a * b).",
    {
      a: z.number().describe("The multiplier"),
      b: z.number().describe("The multiplicand")
    },
    async ({ a, b }) => {
      try {
        const product = a * b;
        return {
          content: [{ type: "text", text: `Result: ${product}` }]
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `Calculation error: ${error.message}` }]
        };
      }
    }
  );

}