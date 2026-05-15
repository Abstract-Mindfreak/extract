# main.py — MMSS Magnetic Builder Backend (порт 8001)
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json, os, math

app = FastAPI(title="MMSS Magnetic Builder")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_methods=["*"], allow_headers=["*"]
)

STATE_FILE = os.path.join(os.path.dirname(__file__), "mmss_state.json")

class ChoiceRequest(BaseModel):
    choice: str

def default_state():
    return {
        "day": 1, "phase": "harmonic",
        "metrics": {
            "charge": 0.20, "spin": 1.00, "wavelength": 0.50,
            "stability": 0.70, "res_x": 0.30, "res_y": -0.10
        },
        "history": []
    }

def load_state():
    if os.path.exists(STATE_FILE):
        with open(STATE_FILE, "r") as f: return json.load(f)
    return default_state()

def save_state(state):
    with open(STATE_FILE, "w") as f: json.dump(state, f, indent=2)

def clamp(v, mn, mx): return max(mn, min(mx, v))

def apply_deltas(m, d):
    for k, v in d.items():
        if k in m: m[k] = clamp(m[k] + v, -1.0 if k != "stability" else 0.0, 1.0)
    return m

def generate_options(state):
    m = state["metrics"]
    opts = [
        {"id": "A", "prompt": "🌀 Усилить притяжение + спин", "deltas": {"charge": 0.15, "spin": 0.25, "wavelength": -0.05, "stability": -0.05}},
        {"id": "B", "prompt": "🌊 Разредить поле + удлинить волну", "deltas": {"charge": -0.10, "spin": -0.10, "wavelength": 0.20, "stability": 0.05}},
        {"id": "C", "prompt": "🛡️ Стабилизировать (robust-якорь)", "deltas": {"charge": 0.00, "spin": 0.00, "wavelength": 0.05, "stability": 0.20}}
    ]
    if m["stability"] < 0.35:
        opts[2]["deltas"]["stability"] = 0.35
        opts[2]["prompt"] = "🛡️ СРОЧНАЯ СТАБИЛИЗАЦИЯ"
    return opts

def check_phase(m, phase):
    if phase == "harmonic" and m["wavelength"] > 0.75 and m["spin"] > 1.4: return "wave"
    if phase == "wave" and m["stability"] < 0.4: return "pulse"
    if phase == "pulse" and m["charge"] > 0.65: return "void"
    return phase

@app.get("/state")
def get_state():
    state = load_state()
    state["options"] = generate_options(state)
    return state

@app.post("/choose")
def make_choice(req: ChoiceRequest):
    state = load_state()
    opts = generate_options(state)
    chosen = next((o for o in opts if o["id"] == req.choice), None)
    if not chosen: return {"error": "invalid_choice"}
    state["metrics"] = apply_deltas(state["metrics"], chosen["deltas"])
    state["phase"] = check_phase(state["metrics"], state["phase"])
    state["history"].append({"day": state["day"], "choice": req.choice})
    state["day"] += 1
    save_state(state)
    state["options"] = generate_options(state)
    return state

# Запуск: uvicorn main:app --reload --port 8001
