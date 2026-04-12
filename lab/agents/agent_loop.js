// ~/lab/agents/agent_loop.js

import Anthropic from '@anthropic-ai/sdk';
import { createWriteStream } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
 
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const logStream = createWriteStream(join(homedir(),'lab','logs','agent.log'), {flags:'a'});
 
function agentLog(level, msg, data={}) {
  logStream.write(JSON.stringify({ts:new Date().toISOString(),level,msg,...data})+'\n');
}
 
export async function runAgentLoop({
  systemPrompt,
  userMessage,
  tools = [],
  toolExecutor,          // async (name, input) => string
  maxIterations = 25,
  model = process.env.ANTHROPIC_MODEL || 'claude-opus-4-5',
  onToolCall = null,      // optional callback: (name, input, result) => void
}) {
  const messages = [{ role:'user', content: userMessage }];
  let iterations = 0;
  agentLog('info', 'Agent started', { model, userMessage: userMessage.slice(0,100) });
 
  while (iterations < maxIterations) {
    iterations++;
    agentLog('info', 'Iteration', { n: iterations });
 
    const response = await client.messages.create({
      model, max_tokens: 8096, system: systemPrompt, tools, messages
    });
 
    agentLog('info', 'Claude response', {
      stop_reason: response.stop_reason,
      usage: response.usage
    });
 
    if (response.stop_reason === 'end_turn') {
      const text = response.content.find(b => b.type==='text')?.text ?? '';
      agentLog('info', 'Agent complete', { iterations, text: text.slice(0,200) });
      return { success:true, result:text, iterations, messages };
    }
 
    if (response.stop_reason === 'tool_use') {
      messages.push({ role:'assistant', content:response.content });
      const toolResults = [];
 
      for (const block of response.content.filter(b => b.type==='tool_use')) {
        agentLog('info', 'Tool call', { name:block.name, input:block.input });
        let result;
        try {
          result = await toolExecutor(block.name, block.input);
        } catch(e) {
          result = `Error executing tool: ${e.message}`;
          agentLog('error', 'Tool error', { name:block.name, error:e.message });
         }
        if (onToolCall) onToolCall(block.name, block.input, result);
        toolResults.push({ type:'tool_result', tool_use_id:block.id, content:result });
      }
      messages.push({ role:'user', content:toolResults });
      continue;
    }
 
    // Unexpected stop reason
    agentLog('warn', 'Unexpected stop_reason', { stop_reason:response.stop_reason });
    break;
  }
 
  agentLog('warn', 'Max iterations reached', { maxIterations });
  return { success:false, result:'Max iterations reached without completion.', iterations, messages };
}
