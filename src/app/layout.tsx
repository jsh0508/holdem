import type { Metadata } from 'next'
export const metadata: Metadata = { title: '🃏 홀덤', description: '텍사스 홀덤 멀티플레이' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body style={{ margin:0, fontFamily:'system-ui,sans-serif', background:'#0d3d1e', minHeight:'100vh' }}>
        {children}
      </body>
    </html>
  )
}
