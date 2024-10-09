#!/bin/bash

# Configuration
AUTHORS=("author1@example.com" "author2@example.com") # List of authors' emails
BRANCH="main" # Branch to analyze
START_DATE="2023-01-01" # Start date for commits
END_DATE="2023-12-31" # End date for commits
OUTPUT_REPORT="report.csv" # Output report file

# Applicable UI file types
UI_EXTENSIONS=("*.js" "*.jsx" "*.html" "*.css" "*.scss" "*.json" "*.hbs" "*.ts" "*.tsx" "*.jpg" "*.jpeg" "*.png" "*.gif" "*.bmp" "*.svg" "*.webp" "*.tiff")

# Function to run a command and check its success
run_command() {
    command=$1
    eval $command
    if [ $? -ne 0 ]; then
        echo "Error executing command: $command"
        exit 1
    fi
}

# Function to analyze the complexity of files
analyze_complexity() {
    local file_path="$1"
    local lines=0
    local cyclomatic_complexity=0
    local maintainability_index=0
    local keys=0
    local medium_score=5 # Default medium score for image files

    if [[ $file_path == *.js || $file_path == *.jsx || $file_path == *.ts || $file_path == *.tsx ]]; then
        lines=$(wc -l < "$file_path")
        cyclomatic_complexity=$(grep -E 'if|for|while|case|catch' "$file_path" | wc -l)
        
        # Maintainability Index calculation
        local halstead_vocabulary=$(grep -o '[a-zA-Z_][a-zA-Z0-9_]*' "$file_path" | sort | uniq | wc -l)
        local halstead_length=$(wc -w < "$file_path")
        maintainability_index=$(echo "scale=2; 171 - 5.2 * l($halstead_length) - 0.23 * l($cyclomatic_complexity) - 16.2 * l($halstead_vocabulary)" | bc -l)

    elif [[ $file_path == *.json ]]; then
        lines=$(wc -l < "$file_path")
        keys=$(jq 'paths | length' "$file_path") # Count keys in JSON
        nested_objects=$(jq 'paths | map(select(length > 1)) | length' "$file_path") # Count nested objects
        keys=$(($keys + $nested_objects))

    elif [[ $file_path == *.scss ]]; then
        lines=$(wc -l < "$file_path")
        # Add additional complexity checks for SCSS if needed

    elif [[ $file_path == *.html || $file_path == *.css || $file_path == *.hbs ]]; then
        lines=$(wc -l < "$file_path")
        # Simple line count for HTML/CSS

    elif [[ $file_path == *.jpg || $file_path == *.jpeg || $file_path == *.png || $file_path == *.gif || $file_path == *.bmp || $file_path == *.svg || $file_path == *.webp || $file_path == *.tiff ]]; then
        lines=0
        cyclomatic_complexity=0
        maintainability_index=$medium_score # Assign medium score for image files
        keys=0
    fi

    echo "$lines,$cyclomatic_complexity,$maintainability_index,$keys" # Return lines, complexity, maintainability, keys
}

# Initialize report with configuration details
echo "Configuration: Authors=${AUTHORS[*]}, Branch=$BRANCH, Start Date=$START_DATE, End Date=$END_DATE" > "$OUTPUT_REPORT"
echo "Author,Total Commits,File Type,Date of Commit,Lines,Cyclomatic Complexity,Maintainability Index,Keys" >> "$OUTPUT_REPORT"

# Iterate over each author
for author in "${AUTHORS[@]}"; do
    # Get commits by the author in the specified date range and branch
    commits=$(git log --author="$author" --since="$START_DATE" --until="$END_DATE" --pretty=format:"%H,%cd" --date=iso -- $BRANCH)

    # Check if there are any commits
    if [ -z "$commits" ]; then
        echo "No commits found for author: $author"
        continue
    fi

    # Initialize total metrics for the author
    total_commits=0
    total_lines=0
    total_cyclomatic_complexity=0
    total_maintainability_index=0
    total_keys=0

    # Iterate over each commit
    while IFS=',' read -r commit_hash commit_date; do
        # Check out the specific commit
        run_command "git checkout $commit_hash"

        # Analyze the complexity of each file
        for ext in "${UI_EXTENSIONS[@]}"; do
            for file in $(git diff-tree --no-commit-id --name-only -r $commit_hash | grep "$ext"); do
                if [ -f "$file" ]; then
                    IFS=',' read -r lines cyclomatic_complexity maintainability_index keys <<< "$(analyze_complexity "$file")"
                    total_commits=$((total_commits + 1))
                    total_lines=$((total_lines + lines))
                    total_cyclomatic_complexity=$((total_cyclomatic_complexity + cyclomatic_complexity))
                    total_maintainability_index=$(echo "$total_maintainability_index + $maintainability_index" | bc)
                    total_keys=$((total_keys + keys))
                    
                    # Write to report
                    echo "$author,1,${file##*.},$commit_date,$lines,$cyclomatic_complexity,$maintainability_index,$keys" >> "$OUTPUT_REPORT"
                fi
            done
        done
    done <<< "$commits"

    # Write summary for the author
    if [ $total_commits -gt 0 ]; then
        avg_maintainability_index=$(echo "$total_maintainability_index / $total_commits" | bc -l)
        echo "$author,$total_commits,Average,Summary,$total_lines,$total_cyclomatic_complexity,$avg_maintainability_index,$total_keys" >> "$OUTPUT_REPORT"
    fi
done

# Checkout back to the original branch
run_command "git checkout $BRANCH"

echo "Report generated: $OUTPUT_REPORT"
