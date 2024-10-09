#!/bin/bash

# Load configuration
CONFIG_FILE="config.json"

# Function to parse JSON (requires jq)
parse_json() {
    echo $(jq -r "$1" $CONFIG_FILE)
}

# Check for jq
if ! command -v jq &> /dev/null; then
    echo "jq could not be found. Please install jq to run this script."
    exit 1
fi

# Get config values
BRANCH=$(parse_json '.branch')
START_DATE=$(parse_json '.startDate')
END_DATE=$(parse_json '.endDate')
AUTHORS=($(parse_json '.authors[]'))

# Initialize report variables
report="Author,Total Commits,File Types,Total Complexity\n"
csv_file="commit_report.csv"

# Define applicable UI file extensions
uiExtensions=("hbs" "html" "htm" "css" "js" "jsx" "ts" "tsx" "json" "xml" "vue" "scss" "less" "php" "asp" "jsp" "py" "rb")

# Function to calculate cyclomatic complexity
calculate_cyclomatic_complexity() {
    local file="$1"
    local complexity=$(grep -E 'if|for|while|case|catch|&&|\|\|' "$file" | wc -l)
    # Cyclomatic Complexity = number of decision points + 1
    echo $((complexity + 1))
}

# Function to calculate complexity based on file type
calculate_complexity() {
    local file="$1"
    local ext="${file##*.}"
    local complexity_score=0
    local loc=$(wc -l < "$file")
    local comment_lines=$(grep -c '//' "$file")  # Simple comment count for JavaScript, modify as needed

    case "$ext" in
        js|jsx|ts|tsx)
            local cyclomatic=$(calculate_cyclomatic_complexity "$file")
            complexity_score=$((loc + cyclomatic - comment_lines))
            ;;
        html|hbs)
            complexity_score=$(( $(grep -o '<[^/>]*' "$file" | wc -l) + $(grep -o ' ' "$file" | wc -l) ))
            ;;
        css|scss|less)
            complexity_score=$(( $(grep -E '^[^@]' "$file" | wc -l) + $(grep -E '\.\\' "$file" | wc -l) ))
            ;;
        json)
            complexity_score=$(( $(jq 'paths | length' "$file" | wc -l) ))
            ;;
        xml)
            complexity_score=$(( $(grep -o '<[^/>]*' "$file" | wc -l) + $(grep -o ' ' "$file" | wc -l) ))
            ;;
        php|asp|jsp|py|rb)
            local cyclomatic=$(calculate_cyclomatic_complexity "$file")
            complexity_score=$((loc + cyclomatic - comment_lines))
            ;;
        *)
            echo "Unsupported file type: $FILE"
            ;;
    esac

    echo "$complexity_score"
}

# Iterate through each author
for AUTHOR in "${AUTHORS[@]}"; do
    echo "Processing commits for: $AUTHOR"

    # Get commit hashes for the author in the specified date range and branch
    COMMITS=$(git log $BRANCH --author="$AUTHOR" --since="$START_DATE" --until="$END_DATE" --pretty=format:"%H")

    # Initialize counters
    TOTAL_COMMITS=0
    FILE_TYPES=""
    TOTAL_COMPLEXITY=0

    # Analyze each commit
    for COMMIT in $COMMITS; do
        TOTAL_COMMITS=$((TOTAL_COMMITS + 1))

        # Check which files were modified in the commit
        FILES=$(git diff-tree --no-commit-id --name-only -r $COMMIT)

        # Analyze each file for complexity
        for FILE in $FILES; do
            # Get the file extension
            EXT="${FILE##*.}"
            
            # Check if the extension is in the uiExtensions array
            if [[ " ${uiExtensions[*]} " == *" $EXT "* ]]; then
                FILE_TYPES+="$(basename "$FILE") "
                # Calculate complexity for the file
                complexity_score=$(calculate_complexity "$FILE")
                TOTAL_COMPLEXITY=$((TOTAL_COMPLEXITY + complexity_score))
            else
                echo "Skipping unsupported file type: $FILE"
            fi
        done
    done

    # Prepare the report entry
    report+="$AUTHOR,$TOTAL_COMMITS,\"$FILE_TYPES\",$TOTAL_COMPLEXITY\n"
done

# Save the report to CSV
echo -e "$report" > "$csv_file"

# Inform the user
echo "Report saved to $csv_file"
