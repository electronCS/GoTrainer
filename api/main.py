"""
GoTrainer FastAPI backend.

Run with:
    cd api && uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import sgf, pattern_search, problems, katago

app = FastAPI(title="GoTrainer API", version="0.1.0")

# CORS — allow the Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4000", "http://localhost:4001", "http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(sgf.router, prefix="/api/sgf", tags=["sgf"])
app.include_router(problems.router, prefix="/api/problems", tags=["problems"])
app.include_router(pattern_search.router)  # WebSocket — no prefix needed
app.include_router(katago.router)          # WebSocket — /ws/katago


@app.get("/health")
async def health():
    return {"status": "ok"}
