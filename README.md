# 🃏 홀덤 멀티플레이 (통합 버전)

Next.js + Socket.io가 하나의 서버로 통합된 버전입니다.
Vercel 없이 Railway 하나만으로 배포 가능합니다.

## 로컬 실행

```bash
npm install
npm run dev
```

http://localhost:3000 접속

## Railway 배포

1. GitHub에 push
2. Railway → New Project → Deploy from GitHub
3. Start Command: `npm start`
4. Deploy 후 도메인 생성 → 친구들에게 공유!

## 구조

- `server.js` — Next.js + Socket.io 통합 서버 (포트 하나)
- `src/app/page.tsx` — 로비 화면
- `src/components/GameRoom.tsx` — 게임 화면 (같은 서버에 자동 연결)
