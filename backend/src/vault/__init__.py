"""Vault module for project storage and artifact management."""

from .novel_vault import (
    novel_write_text,
    novel_read_text,
    novel_get_previous_chapter_final,
    novel_update_manifest,
    novel_parse_outline,
)

__all__ = [
    "novel_write_text",
    "novel_read_text",
    "novel_get_previous_chapter_final",
    "novel_update_manifest",
    "novel_parse_outline",
]
