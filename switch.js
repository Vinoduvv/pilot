#!/bin/bash

# Function to count occurrences of a pattern in a string
count_occurrences() {
    echo "$1" | grep -o "$2" | wc -l
}

# Function to calculate score based on file diff
calculate_score() {
    local fileDiff="$1"
    local ext="$2"
    local fileScore=1  # Start with a low score

    # Count the number of lines in the diff
    local lineCount=$(echo "$fileDiff" | wc -l)

    # Check file extension and calculate score accordingly
    case "$ext" in
        js | jsx)
            functionCount=$(count_occurrences "$fileDiff" "function\s\+\w\+")
            classCount=$(count_occurrences "$fileDiff" "class\s\+\w\+")
            ifCount=$(count_occurrences "$fileDiff" "if\s*\(")
            switchCount=$(count_occurrences "$fileDiff" "switch\s*\(")
            loopCount=$(count_occurrences "$fileDiff" "for\s*\(|while\s*\(")

            (( fileScore += functionCount > 0 ? 5 : 0 ))
            (( fileScore += classCount > 0 ? 7 : 0 ))
            (( fileScore += ifCount > 0 || switchCount > 0 || loopCount > 0 ? 3 : 0 ))
            (( fileScore += (lineCount / 5 < 2 ? lineCount / 5 : 2) ))
            ;;
        
        css)
            cssRuleCount=$(count_occurrences "$fileDiff" "\w\+\s*{")
            mediaQueryCount=$(count_occurrences "$fileDiff" "@media")

            (( fileScore += cssRuleCount > 0 ? 3 : 0 ))
            (( fileScore += mediaQueryCount > 0 ? 2 : 0 ))
            (( fileScore += (lineCount / 5 < 2 ? lineCount / 5 : 2) ))
            ;;
        
        html)
            htmlTagCount=$(count_occurrences "$fileDiff" "<\w\+")
            htmlAttrCount=$(count_occurrences "$fileDiff" "\w\+=\"[^\"]*\"")

            (( fileScore += htmlTagCount > 0 ? 3 : 0 ))
            (( fileScore += htmlAttrCount > 0 ? 2 : 0 ))
            (( fileScore += (lineCount / 5 < 2 ? lineCount / 5 : 2) ))
            ;;
        
        json)
            keyCount=$(echo "$fileDiff" | jq 'keys | length')
            nestedObjectCount=$(count_occurrences "$fileDiff" "{")
            arrayCount=$(count_occurrences "$fileDiff" "\[")

            (( fileScore += keyCount > 0 ? keyCount < 5 ? keyCount : 5 : 0 ))
            (( fileScore += nestedObjectCount > 1 ? 3 : 0 )) 
            (( fileScore += arrayCount > 0 ? 2 : 0 ))
            (( fileScore += (lineCount / 5 < 2 ? lineCount / 5 : 2) ))
            ;;
        
        sass | scss)
            sassVariableCount=$(count_occurrences "$fileDiff" "\$[\w-]+")
            sassMixinCount=$(count_occurrences "$fileDiff" "@mixin\s\+\w\+")
            sassNestingCount=$(count_occurrences "$fileDiff" "^\s*\w\+\s*{")

            (( fileScore += sassVariableCount > 0 ? 3 : 0 ))
            (( fileScore += sassMixinCount > 0 ? 3 : 0 ))
            (( fileScore += sassNestingCount > 0 ? 2 : 0 ))
            (( fileScore += (lineCount / 5 < 2 ? lineCount / 5 : 2) ))
            ;;
        
        hbs)
            hbsHelperCount=$(count_occurrences "$fileDiff" "{{\w\+")
            hbsIfCount=$(count_occurrences "$fileDiff" "{{#if")
            hbsLoopCount=$(count_occurrences "$fileDiff" "{{#each")

            (( fileScore += hbsHelperCount > 0 ? 3 : 0 ))
            (( fileScore += hbsIfCount > 0 ? 2 : 0 ))
            (( fileScore += hbsLoopCount > 0 ? 2 : 0 ))
            (( fileScore += (lineCount / 5 < 2 ? lineCount / 5 : 2) ))
            ;;
        
        *)
            echo "No scoring logic defined for file type: $ext"
            return 0
            ;;
    esac

    # Normalize the score between 1 and 10
    if (( fileScore > 10 )); then
        fileScore=10
    elif (( fileScore < 1 )); then
        fileScore=1
    fi

    echo "$ext:$fileScore"
}

# Check if a commit hash is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <commit-hash>"
    exit 1
fi

# Initialize reporting variables
declare -A totalFileTypeScores
totalCommits=0
totalFiles=0

# Get the list of commits
commits=$(git rev-list --all)

# Iterate through all commits
for commit in $commits; do
    # Get the list of changed files in the specified git commit
    changed_files=$(git show --name-status "$commit")

    # Increment total commits count
    (( totalCommits++ ))

    # Process each changed file
    echo "Changed files in commit $commit:"
    while IFS= read -r line; do
        # Extract the file status and path
        status=$(echo "$line" | awk '{print $1}')
        file=$(echo "$line" | awk '{print $2}')

        if [[ "$status" =~ ^[AM]$ ]]; then  # Only process Added or Modified files
            if [ -f "$file" ]; then
                # Get the diff for the changed file
                fileDiff=$(git show "$commit:$file")
                fileTypeScore=$(calculate_score "$fileDiff" "${file##*.}")

                # Increment the total files count
                (( totalFiles++ ))

                # Extract the file type and score
                fileType=$(echo "$fileTypeScore" | awk -F: '{print $1}')
                score=$(echo "$fileTypeScore" | awk -F: '{print $2}')

                # Accumulate scores by file type
                (( totalFileTypeScores[$fileType] += score ))
            else
                echo "File not found: $file"
            fi
        fi
    done <<< "$changed_files"
done

# Reporting
echo "-------------------------------------"
echo "Total Commits: $totalCommits"
echo "Total Files: $totalFiles"
echo "File Type Scores:"
for type in "${!totalFileTypeScores[@]}"; do
    echo "$type: ${totalFileTypeScores[$type]}"
done
echo "-------------------------------------"
