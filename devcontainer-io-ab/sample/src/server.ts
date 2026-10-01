import express from 'express'
import { modules } from './generated/index.js'

// The measured project: an Express server that imports every generated module and answers GET /
// with a value computed from all of them. Importing them all is the point — that is the work the
// bind mount or the named volume has to carry.

const total = modules.reduce((sum, module) => sum + module.weight, 0)
const port = Number(process.env.PORT ?? '3000')

const app = express()
app.get('/', (_request, response) => {
  response.type('text/plain').send(`modules=${modules.length} total=${total}\n`)
})
app.listen(port, () => {
  process.stdout.write(`ioab-sample: listening on ${port}, ${modules.length} modules\n`)
})
