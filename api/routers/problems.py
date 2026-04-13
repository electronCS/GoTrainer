"""
Problem REST endpoints.

GET  /api/problems         — search problems by tags
GET  /api/problems/tags    — list all available tags
GET  /api/problems/:id     — get a single problem (includes source SGF content if available)
POST /api/problems         — create a new problem
PUT  /api/problems/:id     — update a problem
DELETE /api/problems/:id   — delete a problem
"""

from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from lib.problem_repo import JsonFileRepository, Problem

router = APIRouter()

# Initialize repository
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_FILE = PROJECT_ROOT / "api" / "data" / "problems.json"
repo = JsonFileRepository(str(DATA_FILE))


class ProblemResponse(BaseModel):
    """Problem with optional source SGF content for context viewing."""
    problem: Problem
    source_sgf_content: Optional[str] = None  # full game SGF if source_sgf_file exists


@router.get("")
async def search_problems(
    tags: Optional[str] = Query(None, description="Comma-separated tags to filter by"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    """Search problems by tags. Returns problems + total count."""
    tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else None
    problems = repo.search(tags=tag_list, limit=limit, offset=offset)
    total = repo.count(tags=tag_list)
    return {
        "problems": [p.model_dump() for p in problems],
        "total": total,
        "offset": offset,
        "limit": limit,
    }


@router.get("/tags")
async def list_tags():
    """Return all unique tags across all problems."""
    return {"tags": repo.all_tags()}


@router.get("/{problem_id}")
async def get_problem(problem_id: str):
    """
    Get a single problem.

    Returns:
    - problem: the Problem object (includes `sgf` with the problem tree)
    - source_sgf_content: if `source_sgf_file` is set, the full game SGF for
      context viewing. The frontend can load this game, navigate to
      `source_move_number`, and inject the problem variations at that point.
    """
    problem = repo.get(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="Problem not found")

    # Load source game SGF if referenced
    source_sgf_content = None
    if problem.source_sgf_file:
        sgf_path = PROJECT_ROOT / problem.source_sgf_file
        if sgf_path.exists():
            try:
                source_sgf_content = sgf_path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                source_sgf_content = sgf_path.read_text(encoding="latin-1")

    return ProblemResponse(
        problem=problem,
        source_sgf_content=source_sgf_content,
    ).model_dump()


@router.post("", status_code=201)
async def create_problem(problem: Problem):
    """Create a new problem."""
    created = repo.create(problem)
    return created.model_dump()


@router.put("/{problem_id}")
async def update_problem(problem_id: str, problem: Problem):
    """Update an existing problem."""
    problem.id = problem_id
    updated = repo.update(problem)
    if not updated:
        raise HTTPException(status_code=404, detail="Problem not found")
    return updated.model_dump()


@router.delete("/{problem_id}")
async def delete_problem(problem_id: str):
    """Delete a problem."""
    if not repo.delete(problem_id):
        raise HTTPException(status_code=404, detail="Problem not found")
    return {"message": "Problem deleted"}
