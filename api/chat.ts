// =============================================================
// Vercel Serverless Function — Claude API Proxy
// File location in your project: /api/chat.ts
// =============================================================
// This keeps your Anthropic API key secret on the server side.
// Framer calls THIS endpoint; this function calls Anthropic.
// =============================================================

import type { VercelRequest, VercelResponse } from "@vercel/node"

// ✏️ Paste your full "about me" system prompt here
const SYSTEM_PROMPT = `You are an AI assistant embedded in [Your Name]'s portfolio website.
Answer questions about [Your Name] in a friendly, concise, and conversational way.

Here is everything you know about [Your Name]:

NAME: Danil
ROLE: Product Designer & Generalist
LOCATION: Barcelona, Catalonia, Spain

SKILLS:
- [e.g. React, TypeScript, Node.js, Figma, CSS]
- [Add more skills]

EXPERIENCE:
- [Current Role] at [Company] (Year–Present): [Brief description]
- [Previous Role] at [Company] (Year–Year): [Brief description]

PROJECTS:
- [Project Name]: [What it does, tech used, link if any]
- [Project Name]: [What it does, tech used, link if any]

EDUCATION:
- [Degree] in [Field] from [University] (Year)

ABOUT:
[Write a few sentences about yourself, your personality, what drives you, etc.]

CONTACT:
- Email: [your@email.com]
- LinkedIn: [linkedin.com/in/yourhandle]
- GitHub: [github.com/yourhandle]

RULES:
- Keep answers short (2-4 sentences max unless a detailed answer is clearly needed)
- If you don't know something, say so honestly and suggest they reach out directly
- Never make up information that isn't in this prompt
- Be warm, human, and on-brand`

// Simple in-memory rate limiter (resets per function cold start)
// For persistent rate limiting across instances, use Upstash Redis
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT = 20       // max requests
const RATE_WINDOW_MS = 60 * 60 * 1000  // per hour

function isRateLimited(ip: string): boolean {
    const now = Date.now()
    const entry = rateLimitMap.get(ip)

    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
        return false
    }

    if (entry.count >= RATE_LIMIT) return true

    entry.count++
    return false
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS — replace with your actual Framer domain in production
    // e.g. "https://yoursite.framer.website" or your custom domain
    const allowedOrigins = [
        "https://precious-people-082954.framer.app", 
        "http://localhost:3000",              // for local testing
    ]

    const origin = req.headers.origin || ""
    if (allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin)
    }
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS")
    res.setHeader("Access-Control-Allow-Headers", "Content-Type")

    if (req.method === "OPTIONS") return res.status(200).end()
    if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" })

    // Rate limiting
    const ip =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0].trim() ||
        req.socket.remoteAddress ||
        "unknown"

    if (isRateLimited(ip)) {
        return res.status(429).json({ error: "Too many requests. Please try again later." })
    }

    // Validate body
    const { messages } = req.body || {}
    if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ error: "Invalid messages format" })
    }

    // Cap conversation history to last 10 messages to control costs
    const trimmedMessages = messages.slice(-10)

    try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
                "x-api-key": process.env.ANTHROPIC_API_KEY!,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            body: JSON.stringify({
                model: "claude-haiku-4-5-20251001",
                max_tokens: 512,
                system: SYSTEM_PROMPT,
                messages: trimmedMessages,
            }),
        })

        if (!response.ok) {
            const err = await response.json()
            console.error("Anthropic error:", err)
            return res.status(502).json({ error: "AI service error" })
        }

        const data = await response.json()
        const reply = data?.content?.[0]?.text || "Sorry, I couldn't generate a response."

        return res.status(200).json({ reply })
    } catch (err) {
        console.error("Proxy error:", err)
        return res.status(500).json({ error: "Internal server error" })
    }
}