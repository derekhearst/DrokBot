import fs from 'node:fs'
import postgres from 'postgres'

const envFile = fs.readFileSync('.env', 'utf8')
const dbLine = envFile
	.split(/\r?\n/)
	.find((line) => line.startsWith('DATABASE_URL='))

if (!dbLine) {
	throw new Error('DATABASE_URL not found in .env')
}

const databaseUrl = dbLine.slice('DATABASE_URL='.length).replace(/^"|"$/g, '')
const sql = postgres(databaseUrl)

const cid = process.argv[2] || '8a372d70-23a5-4c4c-bbf1-45ea54e70a58'
const rows = await sql`
	select role, content, tool_calls, created_at
	from messages
	where conversation_id = ${cid}
	order by created_at desc
	limit 8
`

console.log(JSON.stringify(rows, null, 2))
await sql.end({ timeout: 5 })
