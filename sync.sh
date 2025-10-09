#!/bin/bash

# --- CONFIGURATION ---
REPO_DIR="/opt/render/project/src"  # Path to your Git repository
BRANCH="main"                        # Your branch
INTERVAL=10                         
LOG_FILE="$REPO_DIR/.gitlog"         # Log file

# --- Run in background if not already ---
if [[ -z "$SYNC_BACKGROUND" ]]; then
    export SYNC_BACKGROUND=1
    nohup bash "$0" >/dev/null 2>&1 &
    exit
fi

# --- FUNCTION TO SYNC ---
sync_repo() {
    cd "$REPO_DIR" || exit

    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    COMMIT_MSG="Auto-sync commit at $TIMESTAMP"

    echo "---- $TIMESTAMP ----" >> "$LOG_FILE"

    # Add changes
    git add .

    # Commit only if there are changes
    if ! git diff-index --quiet HEAD --; then
        git commit -m "$COMMIT_MSG"
        echo "Committed changes: $COMMIT_MSG" >> "$LOG_FILE"
    else
        echo "No changes to commit." >> "$LOG_FILE"
    fi

    # Pull latest changes
    git pull origin "$BRANCH" --rebase >> "$LOG_FILE" 2>&1

    # Push changes
    git push origin "$BRANCH" >> "$LOG_FILE" 2>&1

    echo "Sync completed." >> "$LOG_FILE"
}

# --- LOOP ---
while true; do
    sync_repo
    sleep $INTERVAL
done
