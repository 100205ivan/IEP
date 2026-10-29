import { createPool, type Pool } from 'mysql2/promise'
import './environment.js'

function requiredEnv(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback
  if (!value) throw new Error(`${name} is required.`)
  return value
}

export const databaseConfig = {
  host: requiredEnv('DB_HOST', '127.0.0.1'),
  port: Number.parseInt(requiredEnv('DB_PORT', '3306'), 10),
  database: requiredEnv('DB_NAME', 'eyeep'),
  user: requiredEnv('DB_USER', 'root'),
  password: process.env.DB_PASSWORD ?? '',
}

export const pool: Pool = createPool({
  ...databaseConfig,
  waitForConnections: true,
  connectionLimit: 10,
  charset: 'utf8mb4',
  dateStrings: true,
})
