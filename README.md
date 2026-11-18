# Free-PI OpenAI-Compatible API Proxy & Dashboard

Proxy server ringan (Zero Dependencies, pure Node.js) untuk mengubah model AI dari `free-pi-cli` (seperti DeepSeek V4.1 Flash, Particle-1, GLM 5.3 Flash, dll.) menjadi **Standard OpenAI-Compatible REST API**, dilengkapi dengan **Web & Terminal Dashboard** untuk memantau usage, sisa kredit allowance harian, dan model yang tersedia.

---

## 🚀 Fitur Utama
1. **Interactive Web Dashboard (`/dashboard`)**:
   - Cek sisa kuota / allowance credits harian (contoh: 15.000 / 15.000 credits).
   - Progress bar sisa kredit & hitung mundur waktu reset harian.
   - Statistik token & request (hari ini dan lifetime).
   - Katalog 18 model lengkap dengan filter (*Free Unlimited*, *Defense*, dll.).
   - Interactive Test Playground: bisa langsung tes prompt & streaming response dari browser!
2. **Terminal CLI Dashboard (`freepi-proxy stats`)**:
   - Tampilan visual di terminal untuk mengecek kredit dan token tanpa perlu membuka browser.
3. **OpenAI Standard Compatible**:
   - `GET /v1/models` (otomatis mengambil daftar model yang tersedia di Free-PI)
   - `POST /v1/chat/completions` (mendukung streaming SSE `stream: true` dan non-stream)
4. **Auto-Auth Detection**: Otomatis membaca token login dari `~/.free-pi/agent/credentials.json`.
5. **CORS Enabled**: Bisa diakses langsung dari web frontend apa saja (NextChat, LibreChat, Chatbox, Cursor, Continue.dev).
6. **Proxy Security (API Key)**: Mendukung proteksi `PROXY_API_KEY` agar proxy aman saat diekspos ke publik / internet.
7. **Zero External Dependencies**: Murni menggunakan native Node.js.

---

## 📊 Cara Mengakses Dashboard

### 1. Web Dashboard (di Browser)
Jalankan proxy:
```bash
freepi-proxy
```
Lalu buka browser Anda ke:
👉 **`http://localhost:3000/dashboard`** (atau `http://localhost:3000`)

### 2. Terminal Dashboard (di CLI)
Ketik langsung di terminal kapan saja:
```bash
freepi-proxy stats
```
*(atau `freepi-proxy dashboard`)*

---

## 🛠️ Cara Menjalankan Proxy

### Menggunakan Command Terminal `freepi-proxy`
```bash
# Jalankan di port default (3000)
freepi-proxy

# Jalankan di port custom
freepi-proxy -p 8080

# Jalankan dengan proteksi API Key
freepi-proxy -p 3000 -k rahasia123

# Cek kuota / usage / kredit di terminal
freepi-proxy stats

# Cek bantuan dan opsi lengkap
freepi-proxy --help
```

### Atau Menjalankan Langsung dengan Node
```bash
cd /home/ris/free-pi-proxy
node server.js
```
Atau menggunakan background/PM2:
```bash
pm2 start server.js --name free-pi-proxy
# atau nohup
nohup node server.js > proxy.log 2>&1 &
```

Secara default, proxy akan berjalan di `http://0.0.0.0:3000`.
URL API OpenAI Anda adalah: `http://localhost:3000/v1`

---

## 🌐 Cara Mengakses Dari Mana Saja (Publik)

Ada beberapa cara mudah agar proxy ini bisa diakses dari perangkat lain atau dari internet secara gratis & aman:

### Opsi A: Menggunakan Cloudflare Tunnel (Paling Direkomendasikan & Gratis)
Cloudflare Tunnel memungkinkan Anda membuat URL HTTPS publik tanpa perlu port forwarding atau IP publik.

1. Download binary `cloudflared`:
   ```bash
   curl -L --output cloudflared https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
   chmod +x cloudflared
   ```
2. Jalankan quick tunnel:
   ```bash
   ./cloudflared tunnel --url http://localhost:3000
   ```
3. Cloudflare akan memberikan URL seperti: `https://xxxx-xxxx-xxxx.trycloudflare.com`
4. Sekarang OpenAI Base URL Anda adalah:
   `https://xxxx-xxxx-xxxx.trycloudflare.com/v1`

### Opsi B: Menggunakan Ngrok / LocalXpose / zrok
Jika memiliki ngrok:
```bash
ngrok http 3000
```
Maka URL API Anda adalah: `https://<subdomain>.ngrok-free.app/v1`

### Opsi C: Deploy ke VPS / Cloud (Railway, Render, VPS Ubuntu)
Salin folder ini ke VPS atau deploy via Docker:
```bash
docker build -t free-pi-proxy .
docker run -d -p 3000:3000 -e FREEPI_TOKEN="<token_anda>" -e PROXY_API_KEY="rahasia123" free-pi-proxy
```
*(Token Anda bisa dilihat di file `~/.free-pi/agent/credentials.json`)*.

---

## 🔒 Mengamankan Proxy dengan API Key
Jika proxy diakses publik, sangat disarankan menambahkan kunci API agar orang lain tidak bisa sembarangan memakai kuota Free-PI Anda:

Jalankan dengan env `PROXY_API_KEY`:
```bash
PROXY_API_KEY="my-secret-key-123" node server.js
```
Maka setiap request ke proxy wajib menyertakan header:
`Authorization: Bearer my-secret-key-123`

---

## 💻 Contoh Penggunaan

### 1. cURL
```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "deepseek-v4-flash",
    "messages": [
      { "role": "user", "content": "Halo! Siapa namamu?" }
    ]
  }'
```

### 2. Python (Official OpenAI SDK)
```python
from openai import OpenAI

client = OpenAI(
    base_url="http://localhost:3000/v1",  # atau URL Cloudflare Tunnel Anda
    api_key="my-secret-key-123"           # isi sembarang jika PROXY_API_KEY kosong
)

response = client.chat.completions.create(
    model="deepseek-v4-flash",
    messages=[
        {"role": "user", "content": "Jelaskan apa itu quantum computing secara singkat!"}
    ]
)

print(response.choices[0].message.content)
```

### 3. JavaScript / TypeScript (OpenAI SDK)
```javascript
import OpenAI from 'openai';

const openai = new OpenAI({
  baseURL: 'http://localhost:3000/v1',
  apiKey: 'my-secret-key-123'
});

const stream = await openai.chat.completions.create({
  model: 'deepseek-v4-flash',
  messages: [{ role: 'user', content: 'Tulis puisi tentang laut' }],
  stream: true,
});

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || '');
}
```

### 4. Di Aplikasi GUI (NextChat, Chatbox, Continue.dev, Cursor)
- **API Host / Base URL**: `http://localhost:3000` atau `https://xxxx.trycloudflare.com` (pastikan akhiran `/v1` sesuai format aplikasi yang meminta `/v1` atau base host)
- **API Key**: Isi dengan `PROXY_API_KEY` (atau isi kata apa saja jika tidak diset)
- **Model**: Pilih salah satu dari:
  - `deepseek-v4-flash`
  - `deepseek-v4.1-flash`
  - `particle`
  - `glm-5.3-flash`
  - `hy4-flash`
