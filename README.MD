# Kaguya - hime ! 🌸

<div align="center">
  <img src="https://cdn.nefusoft.cloud/jiVgu.jpg" width="300" alt="Kaguya-hime" />
  <p><i>Cosmic princess kaguya!</i></p>
</div>

**Kaguya-bot** adalah kerangka kerja bot WhatsApp berbasis Node.js yang mengedepankan performa tinggi, modularitas, dan kemudahan pengembangan. Proyek ini dirancang dengan struktur *clean architecture* untuk memudahkan pengelolaan plugin dan integrasi API pihak ketiga.

---

## 📂 Struktur Direktori
Sistem dirancang agar mudah dikembangkan dengan pemisahan yang jelas antara logika inti, database, dan mesin *scraping*:

```text
kaguya-bot/
├── lib/
│   ├── scraper/         # Logika pengambilan data (API/Scraping)
│   ├── database.js      # Pengelola SQLite (Message, Contact, Group, Settings)
│   ├── helper.js        # Utilitas media & wrapper fungsi WhatsApp
│   ├── plugins.js       # Core engine sistem plugin (Hot-Reload)
│   └── serialize.js     # Serializer pesan (JID, LID, dan metadata)
├── plugins/             # Folder utama fitur (mendukung tree structure)
│   ├── main/            # Kategori 1
│   ├── _ping.js         # Plugins dapat ditambahkan di sini juga, jadi dapat diluar folder kategori maupun didalam kategori
│   └── ...              # Bisa ditambah kategori sesuka hati
├── config.js            # Konfigurasi utama bot
├── index.js             # Entry point aplikasi
└── package.json         # Dependensi proyek
```

---

## 🛠️ Arsitektur Sistem

### 1. Sistem Plugin & Hot-Reload
Bot menggunakan sistem modular di mana setiap file `.js` di dalam folder `plugins/` (termasuk sub-folder) akan dimuat sebagai perintah. Sistem ini mendukung *Hot-Reload*, sehingga Anda bisa menambah atau mengubah kode plugin tanpa perlu melakukan `restart` pada proses bot.

### 2. Scraper Engine (`lib/scraper/`)
Bagian ini khusus menangani pengambilan data dari sumber eksternal. Kami memisahkan logika *scraping* dari file plugin untuk menjaga kebersihan kode (*Separation of Concerns*). Setiap file di folder ini bertindak sebagai penyedia data yang dapat diimpor langsung oleh plugin manapun.

### 3. Persistensi Data
Menggunakan SQLite (`better-sqlite3`) untuk menyimpan status bot, riwayat pesan, pemetaan kontak (`LID` to `JID`), dan konfigurasi grup agar bot tetap stabil meski setelah *restart*.

---

## ⚙️ Konfigurasi
Sebelum menjalankan bot, Anda wajib menyesuaikan file `config.js` untuk mengatur identitas bot dan akses owner:

```javascript
export default {
    botName: 'Nama Bot Anda',
    ownerNumber: ['628xxxxxxxxxx'], // Nomor owner (format string array)
    usePairingCode: true,           // Gunakan pairing code atau QR
    thumbnail1: 'URL_GAMBAR_1',      // URL thumbnail
    thumbnail2: 'URL_GAMBAR_2',
    title: 'Judul Embed',
    body: 'Deskripsi singkat bot',
    sourceUrl: 'https://link-anda.com'
}
```

---

## 🚀 Instalasi

1. **Clone Repository:**
   ```bash
   git clone https://github.com/alip-jmbd/kaguya-bot.git
   cd kaguya-bot
   ```

2. **Instal Dependensi:**
   ```bash
   npm install
   ```

3. **Menjalankan Bot:**
   ```bash
   npm start
   ```

---

## 📝 Lisensi
Proyek ini dilisensikan di bawah **MIT License**.

<div align="center">
  <p>Maintained by <b>LippWangsaff</b></p>
</div>