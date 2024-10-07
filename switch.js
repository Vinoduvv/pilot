switch (ext) {
    case '.json':
        // Parse the JSON file content
        let jsonContent;
        try {
            jsonContent = JSON.parse(code);
        } catch (e) {
            console.error(`Error parsing JSON in file: ${filePath}`);
            break;
        }

        // Count the number of keys in the JSON object
        const keyCount = Object.keys(jsonContent).length;

        // Count nested objects
        const nestedObjectCount = (code.match(/\{/g) || []).length - 1; // Minus 1 for the root level

        // Count arrays in the JSON file
        const arrayCount = (code.match(/\[/g) || []).length;

        // Add points based on the number of keys
        fileScore += Math.min(keyCount, 5); // Up to 5 points for keys

        // Add points for nested objects
        fileScore += Math.min(nestedObjectCount, 3); // Up to 3 points for nested objects

        // Add points for arrays
        fileScore += Math.min(arrayCount, 2); // Up to 2 points for arrays

        // Check if it is a large file (based on character count)
        const charCount = code.length;
        if (charCount > 1000) {
            fileScore += 2; // Add points for larger files
        }
        break;

    // other cases...
}
