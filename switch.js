#!/bin/bash

# Function to count occurrences of a pattern in a file
count_occurrences() {
    grep -o "$1" "$2" | wc -l
}

# Function to calculate file score based on file type
calculate_score() {
    local filePath="$1"
    local ext="${filePath##*.}"
    local fileScore=1  # Start with a low score

    echo "Analyzing $filePath..."

    # Count the number of lines in the file
    local lineCount=$(wc -l < "$filePath")

    # Check file extension and calculate score accordingly
    case "$ext" in
        js | jsx)
            functionCount=$(count_occurrences "function\s\+\w\+" "$filePath")
            classCount=$(count_occurrences "class\s\+\w\+" "$filePath")
            arrowFunctionCount=$(count_occurrences "\(\w*\)\s*=>" "$filePath")
            ifCount=$(count_occurrences "if\s*\(" "$filePath")
            switchCount=$(count_occurrences "switch\s*\(" "$filePath")
            loopCount=$(count_occurrences "for\s*\(|while\s*\(" "$filePath")

            # Add points based on occurrences of complex constructs
            (( fileScore += functionCount > 0 ? 5 : 0 ))
            (( fileScore += classCount > 0 ? 7 : 0 ))
            (( fileScore += ifCount > 0 || switchCount > 0 || loopCount > 0 ? 3 : 0 ))

            # Adjust score by line count
            (( fileScore += (lineCount / 5 < 2 ? lineCount / 5 : 2) ))

            echo "JS/JSX Score for $filePath: $fileScore"
            ;;
        
        css)
            cssRuleCount=$(count_occurrences "\w\+\s*{" "$filePath")
            mediaQueryCount=$(count_occurrences "@media" "$filePath")

            (( fileScore += cssRuleCount > 0 ? 3 : 0 ))
            (( fileScore += mediaQueryCount > 0 ? 2 : 0 ))

            # Adjust score by line count
            (( fileScore += (lineCount / 5 < 2 ? lineCount / 5 : 2) ))

            echo "CSS Score for $filePath: $fileScore"
            ;;

        html)
            htmlTagCount=$(count_occurrences "<\w\+" "$filePath")
            htmlAttrCount=$(count_occurrences "\w\+=\"[^\"]*\"" "$filePath")

            (( fileScore += htmlTagCount > 0 ? 3 : 0 ))
            (( fileScore += htmlAttrCount > 0 ? 2 : 0 ))

            # Adjust score by line count
            (( fileScore += (lineCount / 5 < 2 ? lineCount / 5 : 2) ))

            echo "HTML Score for $filePath: $fileScore"
            ;;

        json)
            keyCount=$(jq 'keys | length' "$filePath")
            nestedObjectCount=$(grep -o "{" "$filePath" | wc -l)
            arrayCount=$(grep -o "\[" "$filePath" | wc -l)
            fileSize=$(wc -c <"$filePath")

            (( fileScore += keyCount > 0 ? keyCount < 5 ? keyCount : 5 : 0 ))
            (( fileScore += nestedObjectCount > 1 ? 3 : 0 ))  # Minus 1 for root
            (( fileScore += arrayCount > 0 ? 2 : 0 ))

            # Adjust score by line count
            (( fileScore += (lineCount / 5 < 2 ? lineCount / 5 : 2) ))

            echo "JSON Score for $filePath: $fileScore"
            ;;

        sass | scss)
            sassVariableCount=$(count_occurrences "\$[\w-]+" "$filePath")
            sassMixinCount=$(count_occurrences "@mixin\s\+\w\+" "$filePath")
            sassNestingCount=$(count_occurrences "^\s*\w\+\s*{" "$filePath")

            (( fileScore += sassVariableCount > 0 ? 3 : 0 ))
            (( fileScore += sassMixinCount > 0 ? 3 : 0 ))
            (( fileScore += sassNestingCount > 0 ? 2 : 0 ))

            # Adjust score by line count
            (( fileScore += (lineCount / 5 < 2 ? lineCount / 5 : 2) ))

            echo "SASS/SCSS Score for $filePath: $fileScore"
            ;;

        hbs)
            hbsHelperCount=$(count_occurrences "{{\w\+" "$filePath")
            hbsIfCount=$(count_occurrences "{{#if" "$filePath")
            hbsLoopCount=$(count_occurrences "{{#each" "$filePath")
            hbsCommentCount=$(count_occurrences "{{!--" "$filePath")

            (( fileScore += hbsHelperCount > 0 ? 3 : 0 ))
            (( fileScore += hbsIfCount > 0 ? 2 : 0 ))
            (( fileScore += hbsLoopCount > 0 ? 2 : 0 ))

            # Adjust score by line count
            (( fileScore += (lineCount / 5 < 2 ? lineCount / 5 : 2) ))

            echo "HBS Score for $filePath: $fileScore"
            ;;

        *)
            echo "No scoring logic defined for file type: $filePath"
            ;;
    esac

    # Normalize the score between 1 and 10
    if (( fileScore > 10 )); then
        fileScore=10
    elif (( fileScore < 1 )); then
        fileScore=1
    fi

    echo "$filePath: Final Score = $fileScore"
}

# Check if a commit hash is provided
if [ -z "$1" ]; then
    echo "Usage: $0 <commit-hash>"
    exit 1
fi

# Get the list of changed files in the specified git commit
changed_files=$(git diff --name-only "$1"^ "$1")

# Iterate over each changed file and calculate score
echo "Changed files in commit $1:"
for file in $changed_files; do
    if [ -f "$file" ]; then
        calculate_score "$file"
    else
        echo "File not found: $file"
    fi
done
