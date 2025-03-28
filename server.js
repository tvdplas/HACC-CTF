const express = require('express')
const path = require('path')
const { parse } = require('csv-parse/sync')
const fs = require('fs')
const app = express()
app.use(express.json())
const config = require('./public/config')

const flavorTexts = require('./public/flavour_texts')
const flags = parse(fs.readFileSync(path.resolve('./flags.csv')), {columns: true, autoParse: true})

let handedInFlags = {}
let startTime = Date.now();
readFromBackup();

function readFromBackup() {
  if (fs.existsSync(path.resolve('./backup.json'))) {
    console.log("reading backed up state")
    const state = JSON.parse(fs.readFileSync(path.resolve('./backup.json')))

    handedInFlags = state.handedInFlags
    startTime = state.startTime
  }
}

async function backup() { 
  const state = {
    handedInFlags, 
    startTime,
  }

  await fs.writeFile(path.resolve("./backup.json"), JSON.stringify(state), () => { console.log("Backup complete") })
}

app.use(express.static('public'))

app.get("/", (req, res) => {
  res.sendFile(path.resolve('./index.html'))
})

app.get("/pandas", (req, res) => {
  res.send("ctf_12460658")
})

app.post("/submit", (req, res) => { 
  let { user, flag } = req.body
  user = user.slice(0, 16);
  flag = flag.slice(0, 16);
  if (!user) {
    res.send({
      accepted: false,
      reason: "No user provided"
    })
    return
  }
  if (!flag) {
    res.send({
      accepted: false,
      reason: "No flag provided"
    })
    return
  }

  // Create user if not yet exists
  if (!handedInFlags[user]) handedInFlags[user] = {};

  const flavor_text = flavorTexts[Math.floor(Math.random() * flavorTexts.length)];

  const f = flags.find(x => x.flag == flag) 
  if (f) {
    if(handedInFlags[user][flag]) {
      res.send({
        accepted: false, 
        reason: "Flag already redeemed for user"
      })
      return
    }
    else {
      handedInFlags[user][flag] = { time: Date.now(), score: parseInt(f.score) };
      res.send({ 
        accepted: true, 
        score: f.score,
        flavor_text, 
      })
      backup() 
      return
    }
  }
  else {
    res.send({
      accepted: false, 
      reason: "Unknown flag."
    })
    return
  }
})

app.get('/standings', (req, res) => { 
  const standings = Object.entries(handedInFlags)
    .map(([user, score]) => ({
      user, 
      score: Object.values(score).reduce((acc, curr) => acc + curr.score, 0), 
      total_time: Math.round(Object.values(score).reduce((acc, curr) => acc + (curr.time - startTime), 0) / 1000)
    })) 
    .sort((a, b) => {
      if (a.score != b.score) return a.score - b.score
      return a.total_time - b.total_time
    })
  res.send(standings)
})

app.listen(config.PORT, () => {
  console.log("Listening on port ", config.PORT)
})