'use client'
import { useState } from 'react'
import GameRoom from '../components/GameRoom'

export default function Home() {
  const [joined, setJoined] = useState(false)
  const [roomId, setRoomId] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [inputRoom, setInputRoom] = useState('')
  const [inputName, setInputName] = useState('')
  const [error, setError] = useState('')

  const handleJoin = () => {
    if (!inputName.trim()) { setError('이름을 입력해주세요'); return }
    if (!inputRoom.trim()) { setError('방 코드를 입력해주세요'); return }
    setPlayerName(inputName.trim())
    setRoomId(inputRoom.trim().toUpperCase())
    setJoined(true)
  }

  if (joined) return <GameRoom roomId={roomId} playerName={playerName} />

  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh' }}>
      <div style={{ background:'#1a5c32', borderRadius:16, padding:'2.5rem', width:320, boxShadow:'0 8px 32px rgba(0,0,0,0.4)', textAlign:'center', color:'#fff' }}>
        <h1 style={{ fontSize:'2.5rem', margin:'0 0 0.5rem' }}>🃏 홀덤</h1>
        <p style={{ color:'#a8d5b5', margin:'0 0 2rem', fontSize:'0.9rem' }}>친구들과 텍사스 홀덤</p>
        {error && <p style={{ background:'#c0392b', borderRadius:8, padding:'0.5rem 1rem', marginBottom:'1rem', fontSize:'0.875rem' }}>{error}</p>}
        <div style={{ textAlign:'left', marginBottom:'1rem' }}>
          <label style={{ display:'block', fontSize:'0.8rem', color:'#a8d5b5', marginBottom:4 }}>닉네임</label>
          <input value={inputName} onChange={e=>{setInputName(e.target.value);setError('')}}
            onKeyDown={e=>e.key==='Enter'&&handleJoin()} placeholder="홍길동" maxLength={12}
            style={{ width:'100%', padding:'0.7rem 1rem', borderRadius:8, border:'1px solid #2d7a4a', background:'#0d3d1e', color:'#fff', fontSize:'1rem', boxSizing:'border-box', outline:'none' }} />
        </div>
        <div style={{ textAlign:'left', marginBottom:'1.5rem' }}>
          <label style={{ display:'block', fontSize:'0.8rem', color:'#a8d5b5', marginBottom:4 }}>방 코드</label>
          <input value={inputRoom} onChange={e=>{setInputRoom(e.target.value.toUpperCase());setError('')}}
            onKeyDown={e=>e.key==='Enter'&&handleJoin()} placeholder="ROOM1" maxLength={10}
            style={{ width:'100%', padding:'0.7rem 1rem', borderRadius:8, border:'1px solid #2d7a4a', background:'#0d3d1e', color:'#fff', fontSize:'1rem', boxSizing:'border-box', outline:'none' }} />
        </div>
        <button onClick={handleJoin}
          style={{ width:'100%', padding:'0.85rem', borderRadius:10, border:'none', background:'#4caf50', color:'#fff', fontSize:'1.1rem', fontWeight:600, cursor:'pointer' }}>
          입장하기
        </button>
        <p style={{ color:'#7ab890', fontSize:'0.78rem', marginTop:'1rem' }}>같은 방 코드를 친구들과 공유하세요 (최대 6명)</p>
      </div>
    </div>
  )
}
