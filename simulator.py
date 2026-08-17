import time
import random
import urllib.request
import json

# Dashboard sunucumuzun adresi
API_URL = "http://127.0.0.1:8000/api/faults"

# Simüle edilecek sahte medikal cihazlar
DEVICES = ["VENTILATOR-OKU-01", "ANESTHESIA-OKU-04", "PATIENT-MONITOR-02", "SUCTION-PUMP-09"]

# Olası medikal arıza senaryoları
FAULTS = [
    {"code": "ERR_PRESS_LOW", "desc": "Hava basıncı kritik eşiğin altına indi", "severity": "KRİTİK"},
    {"code": "ERR_OXY_SENSOR", "desc": "Oksijen sensörü kalibrasyon hatası", "severity": "UYARI"},
    {"code": "ERR_BATTERY_FAIL", "desc": "Yedek batarya devresi yanıt vermiyor", "severity": "KRİTİK"},
    {"code": "ERR_TEMP_HIGH", "desc": "Kompresör sıcaklığı limitin üzerinde", "severity": "UYARI"},
    {"code": "ERR_FLOW_BLOCK", "desc": "Solunum hattında mekanik tıkanıklık algılandı", "severity": "KRİTİK"},
]

print("--- OKUMAN MEDİKAL CİHAZ SİMÜLATÖRÜ BAŞLATILDI ---")
print("Sisteme periyodik arıza sinyalleri gönderiliyor (Durdurmak için Ctrl+C)...\n")

while True:
    # Rastgele bir cihaz ve hata seçiyoruz
    device = random.choice(DEVICES)
    fault = random.choice(FAULTS)

    payload = {
        "device_id": device,
        "error_code": fault["code"],
        "description": fault["desc"],
        "severity": fault["severity"]
    }

    try:
        # FastAPI sunucumuza POST isteği atıyoruz
        req = urllib.request.Request(
            API_URL,
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                print(f"[GÖNDERİLDİ] {device} -> {fault['code']} ({fault['severity']})")
    except Exception as e:
        print(f"[HATA] Sunucuya bağlanılamadı: {e}")

    # 4 ile 8 saniye arasında rastgele bekle ve tekrar gönder
    bekleme_suresi = random.randint(4, 8)
    time.sleep(bekleme_suresi)