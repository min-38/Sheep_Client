# Sheep_Client

## itch.io에 올리기

`npm run build`로 만든 `dist/`의 내용물을 zip으로 묶어 itch.io 프로젝트(종류 HTML)에 올림. `index.html`이 zip 맨 위에 있어야 함.

```bash
npm run build && (cd dist && zip -qr ../itch.zip .)
```

빌드는 `.env.production`의 `VITE_SERVER_URL`로 서버에 붙음.
