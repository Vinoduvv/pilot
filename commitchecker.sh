#!/bin/bash
#Vinod

# List of authors
authors=("John Doe" "Jane Smith" "alex@company.com")

# Remote branch to analyze (example: origin/main)
branch="origin/main"

# Date range (can be customized)
since="2023-01-01"
until="2023-06-30"

# Enhanced complexity analysis function for different file types
function analyze_complexity {
    local commit=$1

    # Get the diff of the commit with file names
    diff=$(git show --pretty="" --unified=0 --name-only $commit)

    echo "Analyzing commit $commit..."
    for file in $diff; do
        # Extract file extension to differentiate between file types
        extension="${file##*.}"

        # Fetch only changes related to the current file
        file_diff=$(git show $commit --pretty="" --unified=0 -- $file)
        code_lines=$(echo "$file_diff" | grep '^[+-]' | grep -v '^+++' | wc -l) # Count added/removed lines

        case "$extension" in
            js)
                # Check for high complexity in JS
                if echo "$file_diff" | grep -q -E "for\|while\|if\|switch\|function\|=>\|class\|async\|await\|Promise\|try\|catch\|throw"; then
                    echo "$file: High Complexity (JS loops, classes, async, promises, try-catch detected)"
                elif [ "$code_lines" -gt 20 ]; then
                    echo "$file: Moderate Complexity (many lines changed in JS)"
                else
                    echo "$file: Low Complexity (simple JS change)"
                fi
                ;;
            hbs)
                # High complexity Handlebars logic (nested templates, helpers, block helpers, etc.)
                if echo "$file_diff" | grep -q "{{#each\|{{#if\|{{#with\|{{#unless\|{{partial\|{{#custom-helper\|{{#block-helper}}"; then
                    echo "$file: High Complexity (complex Handlebars logic)"
                elif [ "$code_lines" -gt 15 ]; then
                    echo "$file: Moderate Complexity (many lines changed in HBS)"
                else
                    echo "$file: Low Complexity (simple HBS change)"
                fi
                ;;
            scss|sass)
                # High complexity Sass changes (mixins, includes, nested rules, loops, imports)
                if echo "$file_diff" | grep -q "@mixin\|@include\|@import\|@for\|@each\|@while\|&\|extend"; then
                    echo "$file: High Complexity (Sass mixins, includes, loops, imports, nesting detected)"
                elif [ "$code_lines" -gt 15 ]; then
                    echo "$file: Moderate Complexity (many lines changed in Sass)"
                else
                    echo "$file: Low Complexity (simple Sass change)"
                fi
                ;;
            json)
                # JSON file changes: low complexity unless it's a large structural change
                if [ "$code_lines" -gt 50 ]; then
                    echo "$file: Moderate Complexity (large JSON change)"
                else
                    echo "$file: Low Complexity (simple JSON change)"
                fi
                ;;
            *)
                echo "$file: File type not analyzed for complexity"
                ;;
        esac
    done
}

# Loop over each author
for author in "${authors[@]}"; do
    echo "Analyzing commits for author: $author"
    
    # Get the number of commits for the author on the specified remote branch within the date range
    num_commits=$(git log $branch --author="$author" --since="$since" --until="$until" --pretty=oneline --abbrev-commit | wc -l)
    
    # Print the number of commits
    echo "Number of commits: $num_commits"
    
    # Get commit hashes and analyze complexity of each commit
    git log $branch --author="$author" --since="$since" --until="$until" --pretty=format:"%h" | while read commit; do
        echo "Commit: $commit"
        analyze_complexity $commit
    done

    echo "------------------------------------"
done
