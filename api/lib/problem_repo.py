"""
Problem repository — stores and retrieves Go problems.

Supports a pluggable backend. Currently implements JsonFileRepository.
To switch to DynamoDB/OpenSearch, implement the same interface.
"""

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from pydantic import BaseModel, Field


class Problem(BaseModel):
    """A Go problem."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    sgf_file: str                         # path to SGF file (relative to project root)
    move_number: int                      # position in the main line
    correct_answers: list[str]            # SGF coordinates, e.g. ["dd", "dp"]
    tags: list[str] = []                  # e.g. ["joseki", "difficulty:3", "player:Lee-Sedol"]
    description: str = ""
    created_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class JsonFileRepository:
    """
    Stores problems in a single JSON file on disk.
    Fast enough for <50k problems.
    """

    def __init__(self, filepath: str):
        self.filepath = Path(filepath)
        self._problems: list[Problem] = []
        self._load()

    def _load(self):
        if self.filepath.exists():
            data = json.loads(self.filepath.read_text(encoding="utf-8"))
            self._problems = [Problem(**p) for p in data]
        else:
            self._problems = []

    def _save(self):
        self.filepath.parent.mkdir(parents=True, exist_ok=True)
        data = [p.model_dump() for p in self._problems]
        self.filepath.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    def search(
        self,
        tags: Optional[list[str]] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Problem]:
        """
        Search problems by tags. All specified tags must be present (AND logic).
        Supports prefix matching: searching "difficulty:3" matches tag "difficulty:3",
        searching "difficulty" matches any tag starting with "difficulty".
        """
        results = self._problems

        if tags:
            def matches(problem_tags, search_tag):
                return any(
                    pt == search_tag or pt.startswith(search_tag + ":")
                    for pt in problem_tags
                )

            results = [
                p for p in results
                if all(matches(p.tags, t) for t in tags)
            ]

        return results[offset:offset + limit]

    def get(self, problem_id: str) -> Optional[Problem]:
        for p in self._problems:
            if p.id == problem_id:
                return p
        return None

    def create(self, problem: Problem) -> Problem:
        # Ensure unique ID
        if self.get(problem.id):
            problem.id = str(uuid.uuid4())[:8]
        self._problems.append(problem)
        self._save()
        return problem

    def update(self, problem: Problem) -> Optional[Problem]:
        for i, p in enumerate(self._problems):
            if p.id == problem.id:
                self._problems[i] = problem
                self._save()
                return problem
        return None

    def delete(self, problem_id: str) -> bool:
        before = len(self._problems)
        self._problems = [p for p in self._problems if p.id != problem_id]
        if len(self._problems) < before:
            self._save()
            return True
        return False

    def count(self, tags: Optional[list[str]] = None) -> int:
        return len(self.search(tags=tags, limit=999999))

    def all_tags(self) -> list[str]:
        """Return all unique tags across all problems."""
        tags = set()
        for p in self._problems:
            tags.update(p.tags)
        return sorted(tags)
