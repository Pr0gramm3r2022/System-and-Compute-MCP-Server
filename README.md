<<<<<<< HEAD
# System and Compute MCP Server Ecosystem
building an MCP server from docs, integrating it with claude code, and deploying it. building with Node.js, MCP SDK, and Anthropic API.
Calculator tool that enables agents to do different types of calculations requiring square roots.
=======
# MCP Agent Lab
>>>>>>> ci/cd

## What the project does

The repository contains an MCP server implementation that can be used by agent-based applications and local LLM clients. It provides a small set of tools that allow agents to:

- perform calculations such as addition, multiplication, division, and square roots
- read and write files within a controlled workspace
- inspect system information such as platform, memory, and runtime details
- make HTTP GET requests to public APIs or other web endpoints
- manage simple task data through a SQLite-backed store

## Project structure

- lab/server.js: the main stdio-based MCP server entry point
- httpmcpserver/http_server.js: an HTTP/SSE version of the server for remote or browser-based clients
- lab/tools/: tool modules for compute, filesystem, web, system, and database actions
- middleware/: authentication and rate-limit support for the HTTP server
- data/ and lab/data/: database setup, logging, and bootstrap helpers

## Why it exists

This lab is intended as a learning and prototyping environment for:

- understanding how MCP servers expose tools to agents
- integrating tools with Claude-style or other LLM clients
- testing safe tool patterns, logging, and basic server security
- exploring how agent workflows can interact with local files, systems, and data

## Technologies

- Node.js and JavaScript/ES modules
- Model Context Protocol (MCP) SDK
- Express for the HTTP server
- SQLite for local task storage
- Anthropic and related SDKs for agent integration experiments

