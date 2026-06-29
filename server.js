const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')
const { Server } = require('socket.io')

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()
const PORT = process.env.PORT || 3000

// ── 상수 ──────────────────────────────────────────
const SUITS = ['♠', '♥', '♦', '♣']
const RANKS = ['2','3','4','5','6','7','8','9','10','J','Q','K','A']
const RANK_VAL = { '2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,'J':11,'Q':12,'K':13,'A':14 }
const STARTING_CHIPS = 1000
const SMALL_BLIND = 10
const BIG_BLIND = 20

function makeDeck() {
  const deck = []
  for (const s of SUITS) for (const r of RANKS) deck.push({ suit: s, rank: r, val: RANK_VAL[r] })
  return shuffle(deck)
}
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function evaluate(cards) {
  const best = bestFive(cards)
  return { rank: handRank(best), cards: best }
}
function bestFive(cards) {
  if (cards.length <= 5) return cards
  let best = null, bestScore = -1
  for (const c of combinations(cards, 5)) {
    const s = handRank(c)
    if (s > bestScore) { bestScore = s; best = c }
  }
  return best
}
function combinations(arr, k) {
  if (k === 0) return [[]]
  if (arr.length < k) return []
  const [first, ...rest] = arr
  return [...combinations(rest, k-1).map(c => [first,...c]), ...combinations(rest, k)]
}
function handRank(cards) {
  const vals = cards.map(c => c.val).sort((a,b) => b-a)
  const suits = cards.map(c => c.suit)
  const flush = suits.every(s => s === suits[0])
  const straight = isStraight(vals)
  const counts = {}
  for (const v of vals) counts[v] = (counts[v]||0)+1
  const groups = Object.values(counts).sort((a,b) => b-a)
  const topVal = vals[0]
  if (flush && straight) return 8000000 + topVal
  if (groups[0]===4) return 7000000 + Number(Object.keys(counts).find(k=>counts[k]===4))
  if (groups[0]===3 && groups[1]===2) return 6000000 + Number(Object.keys(counts).find(k=>counts[k]===3))*100 + Number(Object.keys(counts).find(k=>counts[k]===2))
  if (flush) return 5000000 + topVal*10000+vals[1]*1000+vals[2]*100+vals[3]*10+vals[4]
  if (straight) return 4000000 + topVal
  if (groups[0]===3) return 3000000 + Number(Object.keys(counts).find(k=>counts[k]===3))
  if (groups[0]===2 && groups[1]===2) { const p=Object.keys(counts).filter(k=>counts[k]===2).map(Number).sort((a,b)=>b-a); return 2000000+p[0]*100+p[1] }
  if (groups[0]===2) return 1000000 + Number(Object.keys(counts).find(k=>counts[k]===2))
  return topVal*10000+vals[1]*1000+vals[2]*100+vals[3]*10+vals[4]
}
function isStraight(vals) {
  const u = [...new Set(vals)].sort((a,b)=>b-a)
  if (u.length < 5) return false
  if (u[0]-u[4]===4) return true
  if (JSON.stringify(u.slice(0,4))===JSON.stringify([14,5,4,3,2])) return true
  return false
}
function handName(score) {
  if (score>=8000000) return '스트레이트 플러시'
  if (score>=7000000) return '포카드'
  if (score>=6000000) return '풀하우스'
  if (score>=5000000) return '플러시'
  if (score>=4000000) return '스트레이트'
  if (score>=3000000) return '트리플'
  if (score>=2000000) return '투페어'
  if (score>=1000000) return '원페어'
  return '하이카드'
}

const rooms = {}
function getRoom(id) { return rooms[id] }
function createRoom(id) {
  rooms[id] = { id, players:[], state:'waiting', deck:[], community:[], pot:0, currentBet:0, dealerIdx:0, currentIdx:0, round:'preflop', lastRaiser:null, log:[], winners:null }
  return rooms[id]
}
function addLog(room, msg) { room.log.unshift(msg); if(room.log.length>30) room.log.pop() }

function startGame(room) {
  if (room.players.filter(p=>p.chips>0).length < 2) return false
  room.deck=makeDeck(); room.community=[]; room.pot=0; room.currentBet=0
  room.state='playing'; room.round='preflop'; room.lastRaiser=null; room.winners=null; room.log=[]
  for (const p of room.players) { p.hand=[]; p.bet=0; p.folded=false; p.allIn=false; p.active=p.chips>0; p.lastAction=null }
  const actives = room.players.filter(p=>p.active)
  room.dealerIdx = (room.dealerIdx+1) % actives.length
  for (const p of actives) p.hand=[room.deck.pop(), room.deck.pop()]
  const sbIdx=(room.dealerIdx+1)%actives.length
  const bbIdx=(room.dealerIdx+2)%actives.length
  forceBet(room, actives[sbIdx], SMALL_BLIND)
  forceBet(room, actives[bbIdx], BIG_BLIND)
  room.currentBet=BIG_BLIND
  const firstAct=actives[(bbIdx+1)%actives.length]
  room.currentIdx=room.players.indexOf(firstAct)
  room.lastRaiser=room.players.indexOf(actives[bbIdx])
  addLog(room, `🃏 새 게임! 딜러: ${actives[room.dealerIdx].name}`)
  addLog(room, `💰 SB: ${actives[sbIdx].name}(${SMALL_BLIND}) BB: ${actives[bbIdx].name}(${BIG_BLIND})`)
  return true
}
function forceBet(room, player, amount) {
  const a=Math.min(amount, player.chips)
  player.chips-=a; player.bet+=a; room.pot+=a
  if(player.chips===0) player.allIn=true
}
function nextActive(room, from) {
  for(let i=1;i<=room.players.length;i++) {
    const idx=(from+i)%room.players.length
    const p=room.players[idx]
    if(p.active&&!p.folded&&!p.allIn) return idx
  }
  return -1
}
function handleAction(room, socketId, action, amount) {
  const player=room.players[room.currentIdx]
  if(!player||player.socketId!==socketId) return false
  switch(action) {
    case 'fold': player.folded=true; player.lastAction='fold'; addLog(room,`🃏 ${player.name} 폴드`); break
    case 'check':
      if(player.bet<room.currentBet) return false
      player.lastAction='check'; addLog(room,`✅ ${player.name} 체크`); break
    case 'call': {
      const a=Math.min(room.currentBet-player.bet, player.chips)
      player.chips-=a; player.bet+=a; room.pot+=a
      if(player.chips===0) player.allIn=true
      player.lastAction='call'; addLog(room,`📞 ${player.name} 콜(${a})`); break
    }
    case 'raise': {
      if(!amount||amount<=room.currentBet) return false
      const a=Math.min(amount-player.bet, player.chips)
      player.chips-=a; player.bet+=a; room.pot+=a
      room.currentBet=player.bet; room.lastRaiser=room.currentIdx
      if(player.chips===0) player.allIn=true
      player.lastAction='raise'; addLog(room,`⬆️ ${player.name} 레이즈→${amount}`); break
    }
    default: return false
  }
  const alive=room.players.filter(p=>p.active&&!p.folded)
  if(alive.length===1) { endRound(room,alive); return true }
  const next=nextActive(room,room.currentIdx)
  const allSame=room.players.filter(p=>p.active&&!p.folded).every(p=>p.bet===room.currentBet||p.allIn)
  if(next===-1||allSame) advanceRound(room)
  else room.currentIdx=next
  return true
}
function advanceRound(room) {
  for(const p of room.players){p.bet=0;p.lastAction=null}
  room.currentBet=0
  if(room.round==='preflop'){room.community.push(room.deck.pop(),room.deck.pop(),room.deck.pop());room.round='flop';addLog(room,`🎴 플랍: ${room.community.map(c=>c.rank+c.suit).join(' ')}`)}
  else if(room.round==='flop'){room.community.push(room.deck.pop());room.round='turn';addLog(room,`🎴 턴: ${room.community[3].rank+room.community[3].suit}`)}
  else if(room.round==='turn'){room.community.push(room.deck.pop());room.round='river';addLog(room,`🎴 리버: ${room.community[4].rank+room.community[4].suit}`)}
  else if(room.round==='river'){endRound(room,room.players.filter(p=>p.active&&!p.folded));return}
  const actives=room.players.filter(p=>p.active&&!p.folded&&!p.allIn)
  if(actives.length===0){advanceRound(room);return}
  const dealerPlayer=room.players.filter(p=>p.active)[room.dealerIdx%room.players.filter(p=>p.active).length]
  const di=room.players.indexOf(dealerPlayer)
  const first=nextActive(room,di)
  if(first===-1){advanceRound(room);return}
  room.currentIdx=first; room.lastRaiser=first
}
function endRound(room, contenders) {
  room.state='showdown'
  if(contenders.length===1){
    contenders[0].chips+=room.pot
    addLog(room,`🏆 ${contenders[0].name} 승리! +${room.pot}`)
    room.winners=[{player:contenders[0],handName:'상대 폴드',amount:room.pot}]
    room.pot=0
  } else {
    const results=contenders.map(p=>{const ev=evaluate([...p.hand,...room.community]);return{player:p,score:ev.rank,handName:handName(ev.rank)}}).sort((a,b)=>b.score-a.score)
    results[0].player.chips+=room.pot
    addLog(room,`🏆 ${results[0].player.name} 승리! (${results[0].handName}) +${room.pot}`)
    room.winners=results.map((r,i)=>({player:r.player,handName:r.handName,amount:i===0?room.pot:0}))
    room.pot=0
  }
  for(const p of room.players) if(p.chips<=0) p.active=false
}

function sanitize(room, viewerId) {
  return {
    id:room.id, state:room.state, round:room.round, pot:room.pot,
    currentBet:room.currentBet, community:room.community, currentIdx:room.currentIdx,
    dealerIdx:room.dealerIdx, log:room.log.slice(0,15), winners:room.winners,
    players:room.players.map(p=>({
      id:p.socketId, name:p.name, chips:p.chips, bet:p.bet,
      folded:p.folded, allIn:p.allIn, active:p.active, isHost:p.isHost,
      lastAction:p.lastAction, handCount:p.hand.length,
      hand: p.socketId===viewerId ? p.hand : (room.state==='showdown'&&!p.folded ? p.hand : p.hand.map(()=>null))
    }))
  }
}

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true)
    handle(req, res, parsedUrl)
  })

  const io = new Server(httpServer, {
    cors: { origin: '*', methods: ['GET','POST'] },
    path: '/socket.io'
  })

  io.on('connection', (socket) => {
    socket.on('joinRoom', ({ roomId, playerName }) => {
      let room = getRoom(roomId) || createRoom(roomId)
      if(room.state==='playing'){socket.emit('error','게임이 이미 진행 중입니다');return}
      if(room.players.length>=6){socket.emit('error','방이 꽉 찼습니다');return}
      if(room.players.find(p=>p.name===playerName)){socket.emit('error','이미 같은 이름이 있습니다');return}
      const player={socketId:socket.id,name:playerName,chips:STARTING_CHIPS,hand:[],bet:0,folded:false,allIn:false,active:true,lastAction:null,isHost:room.players.length===0}
      room.players.push(player)
      socket.join(roomId); socket.data.roomId=roomId; socket.data.playerName=playerName
      addLog(room,`👤 ${playerName} 입장`)
      broadcast(io, room)
      socket.emit('joined',{playerId:socket.id,isHost:player.isHost})
    })
    socket.on('startGame',()=>{
      const room=getRoom(socket.data.roomId); if(!room) return
      const p=room.players.find(p=>p.socketId===socket.id); if(!p?.isHost) return
      if(startGame(room)){io.to(room.id).emit('gameStarted');broadcast(io,room)}
    })
    socket.on('action',({action,amount})=>{
      const room=getRoom(socket.data.roomId); if(!room||room.state!=='playing') return
      if(handleAction(room,socket.id,action,amount)){
        broadcast(io,room)
        if(room.state==='showdown') setTimeout(()=>{room.state='waiting';broadcast(io,room)},5000)
      }
    })
    socket.on('nextGame',()=>{
      const room=getRoom(socket.data.roomId); if(!room) return
      const p=room.players.find(p=>p.socketId===socket.id); if(!p?.isHost) return
      room.state='waiting'; broadcast(io,room)
    })
    socket.on('disconnect',()=>{
      const room=getRoom(socket.data.roomId); if(!room) return
      const idx=room.players.findIndex(p=>p.socketId===socket.id)
      if(idx!==-1){
        addLog(room,`👋 ${room.players[idx].name} 퇴장`)
        room.players.splice(idx,1)
        if(room.players.length>0&&!room.players.find(p=>p.isHost)) room.players[0].isHost=true
        broadcast(io,room)
      }
    })
  })

  function broadcast(io, room) {
    for(const p of room.players){
      const s=io.sockets.sockets.get(p.socketId)
      if(s) s.emit('roomUpdate',sanitize(room,p.socketId))
    }
  }

  httpServer.listen(PORT, () => console.log(`🎴 홀덤 서버: http://localhost:${PORT}`))
})
