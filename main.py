from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from pydantic import BaseModel
from typing import Optional
import sqlite3
from datetime import datetime

app = FastAPI(title="Okuman Medikal Arıza Takip Sistemi")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_NAME = "faults.db"

def init_db():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS faults (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            error_code TEXT NOT NULL,
            description TEXT NOT NULL,
            severity TEXT NOT NULL,
            status TEXT DEFAULT 'AÇIK',
            technician_note TEXT DEFAULT '',
            image_data TEXT DEFAULT '',
            timestamp TEXT NOT NULL
        )
    """)
    # Eksik kolonlar varsa tek tek güvenle ekleyelim
    try:
        cursor.execute("ALTER TABLE faults ADD COLUMN status TEXT DEFAULT 'AÇIK'")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE faults ADD COLUMN technician_note TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass
    try:
        cursor.execute("ALTER TABLE faults ADD COLUMN image_data TEXT DEFAULT ''")
    except sqlite3.OperationalError:
        pass

    conn.commit()
    conn.close()

init_db()

class FaultCreate(BaseModel):
    device_id: str
    error_code: str
    description: str
    severity: str
    image_data: Optional[str] = ""

class StatusUpdate(BaseModel):
    status: str
    technician_note: Optional[str] = ""

@app.post("/api/faults")
def create_fault(fault: FaultCreate):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute("""
        INSERT INTO faults (device_id, error_code, description, severity, status, technician_note, image_data, timestamp)
        VALUES (?, ?, ?, ?, 'AÇIK', '', ?, ?)
    """, (fault.device_id, fault.error_code, fault.description, fault.severity, fault.image_data or "", now_str))
    conn.commit()
    fault_id = cursor.lastrowid
    conn.close()
    return {"status": "success", "id": fault_id}

@app.patch("/api/faults/{fault_id}/status")
def update_fault_status(fault_id: int, update_data: StatusUpdate):
    if update_data.status not in ["AÇIK", "İNCELENİYOR", "ÇÖZÜLDÜ"]:
        raise HTTPException(status_code=400, detail="Geçersiz durum.")
    
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    
    if update_data.technician_note:
        cursor.execute("""
            UPDATE faults 
            SET status = ?, technician_note = ? 
            WHERE id = ?
        """, (update_data.status, update_data.technician_note, fault_id))
    else:
        cursor.execute("UPDATE faults SET status = ? WHERE id = ?", (update_data.status, fault_id))

    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Arıza bulunamadı.")
    conn.commit()
    conn.close()
    return {"status": "updated", "id": fault_id, "new_status": update_data.status}

@app.delete("/api/faults/{fault_id}")
def delete_fault(fault_id: int):
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("DELETE FROM faults WHERE id = ?", (fault_id,))
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Arıza bulunamadı.")
    conn.commit()
    conn.close()
    return {"status": "deleted", "id": fault_id}

@app.get("/api/faults")
def get_faults():
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("SELECT id, device_id, error_code, description, severity, status, technician_note, image_data, timestamp FROM faults ORDER BY id DESC")
    rows = cursor.fetchall()
    conn.close()

    fault_list = []
    for r in rows:
        fault_list.append({
            "id": r[0],
            "device_id": r[1],
            "error_code": r[2],
            "description": r[3],
            "severity": r[4],
            "status": r[5] if r[5] else "AÇIK",
            "technician_note": r[6] if r[6] else "",
            "image_data": r[7] if r[7] else "",
            "timestamp": r[8]
        })
    return {"total": len(fault_list), "faults": fault_list}

@app.get("/", response_class=HTMLResponse)
def get_dashboard():
    with open("index.html", "r", encoding="utf-8") as f:
        return f.read()