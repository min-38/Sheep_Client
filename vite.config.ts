import { defineConfig } from 'vite'

// 배포 땐 서버 하나가 클라 파일과 /ws를 같이 서빙함 (기술 설계서 배포).
// 개발 중엔 vite가 /ws를 로컬 서버(server의 dotnet run http 주소)로 넘겨 같은 출처로 맞춤
export default defineConfig({
  server: {
    proxy: { '/ws': { target: 'http://localhost:5049', ws: true } },
  },
})
