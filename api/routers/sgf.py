"""
SGF file endpoints — read/write .sgf files.
"""

import os
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import PlainTextResponse
from pydantic import BaseModel

router = APIRouter()

# Project root (one level up from api/)
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent


class SaveSgfRequest(BaseModel):
    sgf_string: str
    file_path: str = "goTrainer/test.sgf"


@router.get("/file", response_class=PlainTextResponse)
async def get_sgf_file(file: str):
    """Return the contents of an SGF file by path (relative or absolute)."""
    print(f"[SGF] GET /file requested: {file}")
    if not file:
        raise HTTPException(status_code=400, detail="No file specified")

    # Support both relative and absolute paths
    file_path = Path(file)
    if file_path.is_absolute():
        abs_path = file_path.resolve()
    else:
        abs_path = (PROJECT_ROOT / file).resolve()

    # Security: only allow files within the project directory
    if not str(abs_path).startswith(str(PROJECT_ROOT)):
        raise HTTPException(status_code=403, detail=f"Access denied: {abs_path}")

    if not abs_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {abs_path}")

    try:
        return abs_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        # Many SGF files from Asian sources use non-UTF-8 encodings
        try:
            return abs_path.read_text(encoding="latin-1")
        except Exception as e2:
            raise HTTPException(status_code=500, detail=f"Encoding error: {e2}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error reading file: {e}")


@router.post("/save")
async def save_sgf_file(req: SaveSgfRequest):
    """Save an SGF string to a file."""
    abs_path = (PROJECT_ROOT / req.file_path).resolve()

    if not str(abs_path).startswith(str(PROJECT_ROOT)):
        raise HTTPException(status_code=403, detail="Access denied")

    abs_path.parent.mkdir(parents=True, exist_ok=True)
    abs_path.write_text(req.sgf_string, encoding="utf-8")

    return {"message": "SGF file saved successfully", "path": req.file_path}


@router.post("/upload")
async def upload_sgf(file: UploadFile = File(...)):
    """Upload an SGF file — saves to goTrainer/uploads/ and returns contents + path."""
    contents = await file.read()
    text = contents.decode("utf-8")

    # Save to uploads directory so the file is accessible later (e.g. for problem source_sgf_file)
    uploads_dir = PROJECT_ROOT / "goTrainer" / "uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    safe_name = Path(file.filename).name  # strip any directory components
    dest = uploads_dir / safe_name
    dest.write_text(text, encoding="utf-8")

    rel_path = str(dest.relative_to(PROJECT_ROOT))
    return {"sgf": text, "path": rel_path}
