#!/bin/bash
# Vinod

# List of authors
authors=("vinod.anbalagan@test.com")

# Remote branch to analyze (example: origin/main)
branch="origin/dev-2024.11.0"

# Date range (can be customized)
since="2024-07-01"
until="2024-07-30"

# Arrays for file types complexity tracking
javascript=()
hbstemplate=()
cssfiles=()
jsonfiles=()

# Functions to add complexity scores to arrays
add_js() { javascript+=("$1"); }
add_json() { jsonfiles+=("$1"); }
add_hbs() { hbstemplate+=("$1"); }
add_css() { cssfiles+=("$1"); }

# Print the collected complexity values
print_values() {
    echo "Printing Values...."
    echo "JavaScript Complexity Scores: ${javascript[@]}"
    echo "Handlebars Complexity Scores: ${hbstemplate[@]}"
    echo "CSS Complexity Scores: ${cssfiles[@]}"
    echo "JSON Complexity Scores: ${jsonfiles[@]}"
}

# Analyze complexity of commits
analyze_complexity() {
    local commit=$1

    # Get the diff of the commit with file names
    diff=$(git show --pretty="" --unified=0 --name-only "$commit")

    # Check if the diff output is empty
    if [ -z "$diff" ]; then
        echo "No changes detected for commit $commit."
        return
    fi

    echo "Analyzing commit $commit..."
    echo "Changed files: $diff"

    for file in $diff; do
        # Extract file extension
        extension="${file##*.}"

        # Fetch only changes related to the current file
        file_diff=$(git show "$commit" --pretty="" --unified=0 -- "$file")
        code_lines=$(echo "$file_diff" | grep '^[+-]' | grep -v '^+++' | wc -l) # Count added/removed lines
        
        echo "Analyzing file: $file (Type: $extension, Lines changed: $code_lines)"

        case "$extension" in
            js)
                if echo "$file_diff" | grep -q -E "for|while|if|switch|function|=>|class|async|await|Promise|try|catch|throw"; then
                    echo "$file: High Complexity (JS loops, classes, async, promises, try-catch detected)"
                    add_js 3
                elif [ "$code_lines" -gt 20 ]; then
                    echo "$file: Moderate Complexity (many lines changed in JS)"
                    add_js 2
                else
                    echo "$file: Low Complexity (simple JS change)"
                    add_js 1
                fi
                ;;
            hbs)
                if echo "$file_diff" | grep -q "{{#each|{{#if|{{#with|{{#unless|{{partial|{{#custom-helper|{{#block-helper}}"; then
                    echo "$file: High Complexity (complex Handlebars logic)"
                    add_hbs 3
                elif [ "$code_lines" -gt 15 ]; then
                    echo "$file: Moderate Complexity (many lines changed in HBS)"
                    add_hbs 2
                else
                    echo "$file: Low Complexity (simple HBS change)"
                    add_hbs 1
                fi
                ;;
            scss|sass)
                if echo "$file_diff" | grep -q "@mixin|@include|@import|@for|@each|@while|&|extend"; then
                    echo "$file: High Complexity (Sass mixins, includes, loops, imports, nesting detected)"
                    add_css 3
                elif [ "$code_lines" -gt 15 ]; then
                    echo "$file: Moderate Complexity (many lines changed in Sass)"
                    add_css 2
                else
                    echo "$file: Low Complexity (simple Sass change)"
                    add_css 1
                fi
                ;;
            json)
                if [ "$code_lines" -gt 50 ]; then
                    echo "$file: Moderate Complexity (large JSON change)"
                    add_json 3
                else
                    echo "$file: Low Complexity (simple JSON change)"
                    add_json 2
                fi
                ;;
            *)
                echo "$file: File type not analyzed for complexity"
                add_json 1
                ;;
        esac
    done
}

# Loop over each author
for author in "${authors[@]}"; do
    echo "Analyzing commits for author: $author"

    # Get the number of commits for the author on the specified remote branch within the date range
    num_commits=$(git log "$branch" --author="$author" --since="$since" --until="$until" --pretty=oneline --abbrev-commit | wc -l)
    
    # Print the number of commits
    echo "Number of commits: $num_commits"

    # Clear arrays before processing each author
    javascript=()
    hbstemplate=()
    cssfiles=()
    jsonfiles=()

    # Get commit hashes and analyze complexity of each commit
    git log "$branch" --author="$author" --since="$since" --until="$until" --pretty=format:"%h" | while read -r commit; do
        # Check if commit is valid
        if ! git cat-file -e "$commit" 2>/dev/null; then
            echo "Invalid commit: $commit. Skipping."
            continue
        fi
        
        echo "Processing Commit: $commit"
        
        # Count parent commits
        parent_count=$(git cat-file -p "$commit" | grep -c '^parent')
        
        if [ "$parent_count" -gt 1 ]; then
            echo "Skipping merge commit: $commit"
            continue
        fi
        
        analyze_complexity "$commit"
    done
done

# Print all complexity values collected
print_values
