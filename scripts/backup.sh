#!/usr/bin/env bash
# ==============================================================================
# Automated Database Backup Script for Linux CTF Academy & Research Harness
# ==============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$APP_DIR/backups"
TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"

mkdir -p "$BACKUP_DIR"

if [ -f "$APP_DIR/data/research_lab.json" ]; then
    BACKUP_FILE="$BACKUP_DIR/research_lab_$TIMESTAMP.json"
    cp "$APP_DIR/data/research_lab.json" "$BACKUP_FILE"
    gzip "$BACKUP_FILE"
    echo "[$(date -Iseconds)] Successfully backed up database to ${BACKUP_FILE}.gz"
    
    # Prune backups older than 30 days
    find "$BACKUP_DIR" -type f -name "*.json.gz" -mtime +30 -delete
else
    echo "[$(date -Iseconds)] Warning: Database file $APP_DIR/data/research_lab.json not found." >&2
fi
