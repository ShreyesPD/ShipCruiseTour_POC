#!/bin/bash
# Create shipcruisetour database and import schema/data.
# Ensure MySQL is running: brew services start mysql
# Update website/app/Config/config.php (USER, PASS) to match your MySQL user/password.

set -e
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SQL_FILE="$PROJECT_ROOT/Conception & DB/DB -shipcruisetour.sql"

if [ ! -f "$SQL_FILE" ]; then
  echo "Error: SQL file not found: $SQL_FILE"
  exit 1
fi

# Read from PHP config (same as app)
CONFIG="$PROJECT_ROOT/website/app/Config/config.php"
if [ ! -f "$CONFIG" ]; then
  echo "Error: Config not found: $CONFIG"
  exit 1
fi

# Parse USER and PASS from config (simple grep)
DB_USER=$(grep -E "^\s*const USER\s*=" "$CONFIG" | sed -E "s/.*[\"']([^\"']+)[\"'].*/\1/")
DB_PASS=$(grep -E "^\s*const PASS\s*=" "$CONFIG" | sed -E "s/.*[\"']([^\"']+)[\"'].*/\1/")
DB_NAME="shipcruisetour"

echo "Creating database (if not exists) and importing..."
mysql -h 127.0.0.1 -P 3306 -u "$DB_USER" -p"$DB_PASS" -e "CREATE DATABASE IF NOT EXISTS $DB_NAME CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;" 2>/dev/null || {
  echo "MySQL connection failed. Check:"
  echo "  1. MySQL is running: brew services start mysql"
  echo "  2. USER and PASS in website/app/Config/config.php match your MySQL credentials."
  exit 1
}
mysql -h 127.0.0.1 -P 3306 -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < "$SQL_FILE"
echo "Done. Database $DB_NAME is ready."
