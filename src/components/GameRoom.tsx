'use client'
import { useEffect, useState, useRef } from 'react'
import { io, Socket } from 'socket.io-client'

interface Card { suit: string; rank: string }
interface Player {
  id: string; name: string; chips: number; bet: number
  folded: boolean; allIn: boolean; active: boolean; isHost: boolean
  lastAction: string | null; hand: (Card | null)[]; handCount: number
}
interface RoomState {
  id: string; state: string; round: string; pot: number
  currentBet: number; community: Card[]; currentIdx: number
  dealerIdx: number; log: string[]; winners: any[] | null; players: Player[]
}

const SUIT_COLOR: Record<string,string> = { '♥':'#e74c3c','♦':'#e74c3c','♠':'#1a1a2e','♣':'#1a1a2e' }
const ACTION_KO: Record<string,string> = { fold:'폴드', check:'체크', call:'콜', raise:'레이즈' }

function Card({ card, hidden }: { card: Card|null; hidden?: boolean }) {
  if (hidden || !card) return (
    <div style={{ width:50,height:72,background:'#1a5c32',border:'2px solid #2d7a4a',borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'1.4rem' }}>🂠</div>
  )
  return (
    <div style={{ width:50,height:72,background:'#f5f0e8',border:'2px solid #ddd',borderRadius:6,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',color:SUIT_COLOR[card.suit]||'#333',fontWeight:700 }}>
      <span style={{ fontSize:'0.9rem',lineHeight:1 }}>{card.rank}</span>
      <span style={{ fontSize:'1rem',lineHeight:1 }}>{card.suit}</span>
    </div>
  )
}

export default function GameRoom({ roomId, playerName }: { roomId: string; playerName: string }) {
  const [room, setRoom] = useState<RoomState|null>(null)
  const [myId, setMyId] = useState('')
  const [isHost, setIsHost] = useState(false)
  const [raiseAmt, setRaiseAmt] = useState(40)
  const [error, setError] = useState('')
  const socketRef = useRef<Socket|null>(null)

  useEffect(() => {
    // 같은 서버에 연결 (별도 URL 불필요)
    const socket = io({ path: '/socket.io', transports: ['polling','websocket'] })
    socketRef.current = socket
    socket.on('connect', () => socket.emit('joinRoom', { roomId, playerName }))
    socket.on('joined', ({ playerId, isHost: h }: any) => { setMyId(playerId); setIsHost(h) })
    socket.on('roomUpdate', (data: RoomState) => {
      setRoom(data)
      const me = data.players.find(p => p.id === socket.id)
      if (me) setIsHost(me.isHost)
    })
    socket.on('error', (msg: string) => { setError(msg); setTimeout(()=>setError(''), 3000) })
    return () => { socket.disconnect() }
  }, [roomId, playerName])

  const emit = (ev: string, data?: any) => socketRef.current?.emit(ev, data)

  if (!room) return (
    <div style={{ display:'flex',alignItems:'center',justifyContent:'center',minHeight:'100vh' }}>
      <p style={{ color:'#a8d5b5' }}>입장 중...</p>
    </div>
  )

  const me = room.players.find(p => p.id === myId)
  const isMyTurn = room.state==='playing' && room.players[room.currentIdx]?.id===myId
  const callAmt = me ? room.currentBet - me.bet : 0
  const canCheck = isMyTurn && me && me.bet >= room.currentBet
  const minRaise = room.currentBet + BIG_BLIND
  const myMax = me ? me.chips + me.bet : minRaise

  return (
    <div style={{ maxWidth:800, margin:'0 auto', padding:'1rem', color:'#fff' }}>
      {error && <div style={{ position:'fixed',top:'1rem',left:'50%',transform:'translateX(-50%)',background:'#c0392b',color:'#fff',padding:'0.6rem 1.4rem',borderRadius:8,zIndex:999 }}>{error}</div>}

      {/* 상단 */}
      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',background:'#1a5c32',borderRadius:10,padding:'0.6rem 1rem',marginBottom:'1rem' }}>
        <span style={{ fontSize:'0.85rem',color:'#a8d5b5' }}>방: {room.id}</span>
        <span style={{ background:'#2d7a4a',borderRadius:6,padding:'3px 10px',fontSize:'0.8rem',fontWeight:600 }}>
          {room.state==='playing' ? room.round.toUpperCase() : room.state==='showdown' ? '쇼다운' : '대기중'}
        </span>
        <span style={{ fontWeight:600 }}>팟: {room.pot} 💰</span>
      </div>

      {/* 커뮤니티 카드 */}
      <div style={{ display:'flex',justifyContent:'center',gap:8,marginBottom:'1rem' }}>
        {[0,1,2,3,4].map(i => room.community[i]
          ? <Card key={i} card={room.community[i]} />
          : <div key={i} style={{ width:50,height:72,background:'rgba(255,255,255,0.05)',border:'2px dashed rgba(255,255,255,0.15)',borderRadius:6 }} />
        )}
      </div>

      {/* 플레이어 */}
      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:10,marginBottom:'1rem' }}>
        {room.players.map((p, i) => {
          const isTurn = room.state==='playing' && room.currentIdx===i
          const isMe = p.id===myId
          return (
            <div key={p.id} style={{ background:'#1a5c32',borderRadius:10,padding:'0.75rem',border:`2px solid ${isTurn?'#f1c40f':isMe?'#4caf50':'transparent'}`,opacity:p.folded?0.45:1,transition:'border 0.2s' }}>
              <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:4,flexWrap:'wrap' }}>
                <span style={{ fontWeight:600,fontSize:'0.95rem' }}>{p.name} {p.isHost?'👑':''}</span>
                {p.allIn && <span style={{ background:'#e74c3c',borderRadius:4,padding:'1px 6px',fontSize:'0.7rem' }}>올인</span>}
                {p.folded && <span style={{ background:'#555',borderRadius:4,padding:'1px 6px',fontSize:'0.7rem' }}>폴드</span>}
                {p.lastAction && !p.folded && <span style={{ background:'#2980b9',borderRadius:4,padding:'1px 6px',fontSize:'0.7rem' }}>{ACTION_KO[p.lastAction]||p.lastAction}</span>}
              </div>
              <div style={{ fontSize:'0.82rem',color:'#a8d5b5',marginBottom:6,display:'flex',gap:8 }}>
                <span>💰 {p.chips}</span>
                {p.bet>0 && <span style={{ color:'#f1c40f' }}>베팅: {p.bet}</span>}
              </div>
              <div style={{ display:'flex',gap:5,flexWrap:'wrap' }}>
                {isMe ? p.hand.map((c,j)=><Card key={j} card={c} />) :
                  room.state==='showdown' && !p.folded ? p.hand.map((c,j)=><Card key={j} card={c} />) :
                  Array.from({length:p.handCount}).map((_,j)=><Card key={j} card={null} hidden />)}
              </div>
            </div>
          )
        })}
      </div>

      {/* 쇼다운 */}
      {room.state==='showdown' && room.winners && (
        <div style={{ background:'#1a5c32',borderRadius:12,padding:'1rem 1.5rem',marginBottom:'1rem',textAlign:'center' }}>
          <h3 style={{ margin:'0 0 0.5rem' }}>🏆 결과</h3>
          {room.winners.map((w:any,i:number)=>(
            <div key={i} style={{ fontSize:'0.9rem',color:'#a8d5b5',lineHeight:1.7 }}>
              {i===0?'🥇':'  '} {w.player.name} — {w.handName} {w.amount>0?`+${w.amount}칩`:''}
            </div>
          ))}
        </div>
      )}

      {/* 액션 */}
      {room.state==='playing' && isMyTurn && me && !me.folded && !me.allIn && (
        <div style={{ background:'#1a5c32',borderRadius:12,padding:'1rem',marginBottom:'1rem',display:'flex',gap:8,flexWrap:'wrap',alignItems:'center' }}>
          <button onClick={()=>emit('action',{action:'fold'})} style={{ background:'#c0392b',color:'#fff',border:'none',borderRadius:8,padding:'0.65rem 1.2rem',fontWeight:600,cursor:'pointer' }}>폴드</button>
          {canCheck
            ? <button onClick={()=>emit('action',{action:'check'})} style={{ background:'#27ae60',color:'#fff',border:'none',borderRadius:8,padding:'0.65rem 1.2rem',fontWeight:600,cursor:'pointer' }}>체크</button>
            : <button onClick={()=>emit('action',{action:'call'})} style={{ background:'#2980b9',color:'#fff',border:'none',borderRadius:8,padding:'0.65rem 1.2rem',fontWeight:600,cursor:'pointer' }}>콜 ({callAmt})</button>
          }
          <div style={{ display:'flex',alignItems:'center',gap:8,flex:1 }}>
            <input type="range" min={minRaise} max={myMax} step={10} value={raiseAmt}
              onChange={e=>setRaiseAmt(Number(e.target.value))} style={{ flex:1 }} />
            <button onClick={()=>emit('action',{action:'raise',amount:raiseAmt})}
              style={{ background:'#e67e22',color:'#fff',border:'none',borderRadius:8,padding:'0.65rem 1.2rem',fontWeight:600,cursor:'pointer' }}>
              레이즈 ({raiseAmt})
            </button>
          </div>
        </div>
      )}

      {/* 호스트 */}
      {isHost && room.state==='waiting' && (
        <div style={{ background:'#1a5c32',borderRadius:12,padding:'1rem',marginBottom:'1rem',textAlign:'center' }}>
          <p style={{ color:'#a8d5b5',fontSize:'0.85rem',margin:'0 0 0.75rem' }}>플레이어 {room.players.length}명 / 최소 2명</p>
          <button onClick={()=>emit('startGame')} disabled={room.players.filter(p=>p.active).length<2}
            style={{ background:'#4caf50',color:'#fff',border:'none',borderRadius:10,padding:'0.75rem 2rem',fontSize:'1rem',fontWeight:600,cursor:'pointer' }}>
            게임 시작
          </button>
        </div>
      )}
      {isHost && room.state==='showdown' && (
        <div style={{ textAlign:'center',marginBottom:'1rem' }}>
          <button onClick={()=>emit('nextGame')} style={{ background:'#4caf50',color:'#fff',border:'none',borderRadius:10,padding:'0.75rem 2rem',fontSize:'1rem',fontWeight:600,cursor:'pointer' }}>다음 게임</button>
        </div>
      )}

      {/* 로그 */}
      <div style={{ background:'rgba(0,0,0,0.3)',borderRadius:10,padding:'0.75rem 1rem',maxHeight:140,overflowY:'auto' }}>
        {room.log.map((l,i)=><div key={i} style={{ fontSize:'0.8rem',color:'#a8d5b5',lineHeight:1.7 }}>{l}</div>)}
      </div>
    </div>
  )
}

const BIG_BLIND = 20
