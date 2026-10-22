import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'

// Resolve relative to this backend source file so npm's launch directory cannot
// accidentally select a frontend or repository-level .env file.
const envPath = fileURLToPath(new URL('../../.env', import.meta.url))
config({ path: envPath, quiet: true })

export const geminiApiKeyPresent = Boolean(process.env.GEMINI_API_KEY?.trim())
