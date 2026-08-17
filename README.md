# 🏥 Okuman Medikal - Saha Arıza Takip & Yönetim Platformu

Bu proje, medikal cihazların (Ventilatör, Anestezi Cihazı, Hasta Başı Monitörü vb.) arıza telemetri verilerini anlık olarak toplayan, sahadaki teknisyenler ile merkez mühendislik ekibini canlı senkronize eden **Full-Stack IoT & Saha Servis Yönetimi (FSM)** platformudur.

---

## 🚀 Temel Özellikler

### 📱 1. Saha Operatör Terminali (Mobil Uygulama - React Native / Expo)
* **Fotoğraflı Arıza Bildirimi:** Saha teknisyeni arızalı cihazın veya parçasının fotoğrafını doğrudan kamera ile çekip veya galeriden seçip sisteme yükleyebilir.
* **Akıllı Alarm & Dokunsal Geri Bildirim (Haptic):** Kritik seviyeli bir arıza oluştuğunda cihaz titrer ve tepeden acil durum uyarı banner'ı iner.
* **Hızlı Takip:** Sahadaki mevcut arıza durumlarını anlık arama ve filtreleme ile izleme.

### 💻 2. Merkezi Teknik Yönetim Masası (Web Dashboard)
* **Sekmeli Yönetim:** *Bekleyen Açık Arızalar*, *Müdahale/İnceleme Masası* ve *Onarılanlar & Arşiv* ekranları.
* **Görsel Teşhis (Lightbox):** Sahadan gelen fotoğrafların önizlemesi ve tıklandığında tam ekran büyütülebilmesi.
* **Teknisyen Müdahale Notu:** Yapılan teknik işlemlerin (kalibrasyon, parça değişimi vb.) not olarak eklenmesi ve durum güncellemesi.
* **Kayıt Yönetimi:** Çözülen veya gereksiz kayıtların kalıcı olarak silinebilmesi.

### ⚙️ 3. Backend & Veritabanı (FastAPI + SQLite)
* **RESTful API:** `GET`, `POST`, `PATCH`, `DELETE` uç noktaları ile tam kapsamlı CRUD operasyonları.
* **Base64 Görsel Depolama:** Fotoğrafların yerel veritabanında saklanması ve sunulması.
* **LAN Yayını:** Yerel ağ üzerindeki tüm cihazlarla sıfır gecikmeli haberleşme.

---

## 🛠️ Kullanılan Teknolojiler

| Katman | Teknoloji / Kütüphane |
| :--- | :--- |
| **Backend** | Python 3, FastAPI, Uvicorn, SQLite3, Pydantic |
| **Web Frontend** | HTML5, Tailwind CSS, FontAwesome, JavaScript (Fetch API) |
| **Mobil Frontend** | React Native, Expo, Expo Image Picker, Expo Haptics |
| **Donanım Simülasyonu** | Python Requests (Opsiyonel Telemetri Simülatörü) |

---

## 💻 Kurulum ve Çalıştırma

### 1. Backend'i Başlatma
```bash
# Gerekli Python paketlerini yükleyin
pip install fastapi uvicorn pydantic requests

# Sunucuyu başlatın
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload