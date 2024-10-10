#!/bin/bash
# Vinod

# List of authors
authors=("vinod.anbalagan@test.com" "another.author@test.com")  # Add more authors as needed

# Remote branch to analyze (example: origin/main)
branch="origin/dev-2024.11.0"

# Date range (can be customized)
since="2024-07-01"
until="2024-07-30"

# Global arrays for file types complexity tracking
javascript=()
hbstemplate=()
cssfiles=()
jsonfiles=()

# Output CSV file
output_file="complexity_report.csv"

# Functions to add complexity scores to arrays
add_js() { javascript+=("$1"); }
add_json() { jsonfiles+=("$1"); }
add_hbs() { hbstemplate+=("$1"); }
add_css() { cssfiles+=("$1"); }

# Print the collected complexity values
print_values() {
    echo "Printing Values for Author: $1"
    echo "JavaScript Complexity Scores: ${javascript[@]}"
    echo "Handlebars Complexity Scores: ${hbstemplate[@]}"
    echo "CSS Complexity Scores: ${cssfiles[@]}"
    echo "JSON Complexity Scores: ${jsonfiles[@]}"
}

# Analyze complexity of commits
analyze_complexity() {
    local commit=$1
    local author=$2

    # Get the diff of the commit with file names
    diff=$(git show --pretty="" --unified=0 --name-only "$commit")

    # Check if the diff output is empty
    if [ -z "$diff" ]; then
        echo "No changes detected for commit $commit."
        return
    fi

    # Get the commit date
    commit_date=$(git show -s --format="%ci" "$commit")

    echo "Analyzing commit $commit for author $author on $commit_date..."
    echo "Changed files: $diff"

    for file in $diff; do
        # Extract file extension
        extension="${file##*.}"

        # Fetch only changes related to the current file
        file_diff=$(git show "$commit" --pretty="" --unified=0 -- "$file")
        code_lines=$(echo "$file_diff" | grep '^[+-]' | grep -v '^+++' | wc -l) # Count added/removed lines
        
        echo "Analyzing file: $file (Type: $extension, Lines changed: $code_lines)"
        
        # Prepare for CSV output
        score=0
        complexity_level="Low"

        case "$extension" in
            js)
                if echo "$file_diff" | grep -q -E "for|while|if|switch|function|=>|class|async|await|Promise|try|catch|throw"; then
                    complexity_level="High"
                    score=3
                elif [ "$code_lines" -gt 20 ]; then
                    complexity_level="Moderate"
                    score=2
                else
                    complexity_level="Low"
                    score=1
                fi
                add_js "$score"
                ;;
            hbs)
                if echo "$file_diff" | grep -q "{{#each|{{#if|{{#with|{{#unless|{{partial|{{#custom-helper|{{#block-helper}}"; then
                    complexity_level="High"
                    score=3
                elif [ "$code_lines" -gt 15 ]; then
                    complexity_level="Moderate"
                    score=2
                else
                    complexity_level="Low"
                    score=1
                fi
                add_hbs "$score"
                ;;
            scss|sass)
                if echo "$file_diff" | grep -q "@mixin|@include|@import|@for|@each|@while|&|extend"; then
                    complexity_level="High"
                    score=3
                elif [ "$code_lines" -gt 15 ]; then
                    complexity_level="Moderate"
                    score=2
                else
                    complexity_level="Low"
                    score=1
                fi
                add_css "$score"
                ;;
            json)
                if [ "$code_lines" -gt 50 ]; then
                    complexity_level="Moderate"
                    score=3
                else
                    complexity_level="Low"
                    score=2
                fi
                add_json "$score"
                ;;
            *)
                echo "$file: File type not analyzed for complexity"
                score=1
                add_json "$score"
                ;;
        esac
        
        # Save results to CSV, including commit date
        echo "$author,$commit,$commit_date,$file,$extension,$complexity_level,$code_lines" >> "$output_file"
    done
}

# Initialize the CSV file with headers
echo "Author,Commit,Date,File,Extension,Complexity Level,Lines Changed" > "$output_file"

# Loop over each author
for author in "${authors[@]}"; do
    echo "Analyzing commits for author: $author"

    # Clear arrays before processing each author
    javascript=()
    hbstemplate=()
    cssfiles=()
    jsonfiles=()

    # Get the commits for the author on the specified remote branch within the date range
    commits=$(git log "$branch" --author="$author" --since="$since" --until="$until" --pretty=format:"%h")

    # Print the number of commits
    num_commits=$(echo "$commits" | wc -l)
    echo "Number of commits: $num_commits"

    # Process each commit without using a pipe
    while IFS= read -r commit; do
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
        
        analyze_complexity "$commit" "$author"
    done <<< "$commits"  # Read commits here to avoid subshell

    # Print all complexity values collected for the author
    print_values "$author"
done

# Notify completion
echo "Analysis complete. Results saved to $output_file."
