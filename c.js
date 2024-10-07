const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Define the commit hash to analyze
const commitHash = process.argv[2];

if (!commitHash) {
    console.error('Please provide a git commit hash.');
    process.exit(1);
}

try {
    console.log(`Fetching files changed in commit ${commitHash}...`);

    // Get the list of files changed in the commit using git show
    const showOutput = execSync(`git show --name-status ${commitHash}`).toString();
    console.log(`Raw show output:\n${showOutput}`); // Show raw output for debugging

    // Split the output by line and filter for relevant file changes
    const lines = showOutput.split('\n').filter(line => line.startsWith('A') || line.startsWith('M'));

    if (lines.length === 0) {
        console.log('No files changed in this commit.');
        return;
    }

    console.log(`Changed files:`, lines);

    // Score results
    const scores = {};

    // Process each file based on its status and extension
    lines.forEach(line => {
        const [status, filePath] = line.split('\t'); // Split status and file name

        // Ensure filePath is valid before processing
        if (!filePath) {
            console.error(`No file path found for line: ${line}`);
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        let fileScore = 1; // Start with a low score

        // Read file content for analysis
        const code = fs.readFileSync(filePath, 'utf8');

        // Analyze the code complexity and determine the score
        const functionCount = (code.match(/function\s+\w+/g) || []).length; // Count function declarations
        const classCount = (code.match(/class\s+\w+/g) || []).length; // Count class declarations
        const customFunctionCount = (code.match(/\w+\s*=\s*function/g) || []).length; // Count custom function assignments
        const arrowFunctionCount = (code.match(/(\(\w*\)\s*=>|(\w+\s*)=>)/g) || []).length; // Count arrow functions
        const ifStatementCount = (code.match(/if\s*\(/g) || []).length; // Count if statements
        const switchCount = (code.match(/switch\s*\(/g) || []).length; // Count switch statements
        const loopCount = (code.match(/for\s*\(|while\s*\(/g) || []).length; // Count loops
        const destructuringCount = (code.match(/\{.*\}/g) || []).length; // Count destructuring assignments
        const templateLiteralCount = (code.match(/`[^`]*`/g) || []).length; // Count template literals
        const lineCount = code.split('\n').length; // Count lines of code
        const commentCount = (code.match(/\/\//g) || []).length + (code.match(/\/\*\*/g) || []).length; // Count comments

        // Scoring logic for JavaScript files
        if (classCount > 0) {
            fileScore += 7; // High complexity for class usage
        } else if (functionCount > 0 || customFunctionCount > 0 || arrowFunctionCount > 0) {
            fileScore += 5; // Moderate complexity for function usage
        }
        if (ifStatementCount > 0 || switchCount > 0 || loopCount > 0) {
            fileScore += 3; // Add complexity for control structures
        }
        if (destructuringCount > 0) {
            fileScore += 2; // Add points for destructuring usage
        }
        if (templateLiteralCount > 0) {
            fileScore += 2; // Add points for using template literals
        }
        if (commentCount > 0) {
            fileScore += 1; // Add points for comments (encourages documentation)
        }
        // Scale by number of lines
        fileScore += Math.min(lineCount / 5, 2); // Add points for more lines of code

        // Specific scoring adjustments for CSS, SASS, SCSS, HTML, and HBS
        switch (ext) {
            case '.css':
                // Check for CSS specific complexity
                const cssRuleCount = (code.match(/\w+\s*{/g) || []).length; // Count CSS rules
                const mediaQueryCount = (code.match(/@media/g) || []).length; // Count media queries
                fileScore += Math.min(cssRuleCount, 3); // Add points based on the number of CSS rules
                fileScore += Math.min(mediaQueryCount, 2); // Add points for media queries
                break;

            case '.sass':
            case '.scss':
                // Check for SASS/SCSS specific complexity
                const sassVariableCount = (code.match(/\$[\w-]+/g) || []).length; // Count SASS variables
                const sassMixinCount = (code.match(/@mixin\s+\w+/g) || []).length; // Count mixins
                const sassNestingCount = (code.match(/^\s*\w+\s*{/gm) || []).length; // Count nesting

                // Count CSS rules within SASS/SCSS
                const sassCssRuleCount = (code.match(/\w+\s*{/g) || []).length; // Count CSS rules
                const sassMediaQueryCount = (code.match(/@media/g) || []).length; // Count media queries in SASS/SCSS

                fileScore += Math.min(sassVariableCount, 3); // Add points based on the number of SASS variables
                fileScore += Math.min(sassMixinCount, 3); // Add points for mixins
                fileScore += Math.min(sassNestingCount, 2); // Add points for nesting
                fileScore += Math.min(sassCssRuleCount, 3); // Add points for CSS rules in SASS/SCSS
                fileScore += Math.min(sassMediaQueryCount, 2); // Add points for media queries in SASS/SCSS
                break;

            case '.html':
                // Check for HTML specific complexity
                const htmlTagCount = (code.match(/<\w+/g) || []).length; // Count HTML tags
                const htmlAttrCount = (code.match(/\w+="[^"]*"/g) || []).length; // Count HTML attributes
                fileScore += Math.min(htmlTagCount, 3); // Add points based on the number of HTML tags
                fileScore += Math.min(htmlAttrCount, 2); // Add points for attributes
                break;

            case '.hbs':
                // Check for Handlebars specific complexity
                const hbsHelperCount = (code.match(/{{\w+/g) || []).length; // Count Handlebars helpers
                const hbsIfCount = (code.match(/{{#if/g) || []).length; // Count if blocks
                const hbsLoopCount = (code.match(/{{#each/g) || []).length; // Count each blocks
                const hbsCommentCount = (code.match(/{{!--/g) || []).length; // Count Handlebars comments
                const htmlInHbsCount = (code.match(/<\w+/g) || []).length; // Count HTML tags in Handlebars
                fileScore += Math.min(hbsHelperCount, 3); // Add points based on the number of helpers
                fileScore += Math.min(hbsIfCount, 2); // Add points for if blocks
                fileScore += Math.min(hbsLoopCount, 2); // Add points for each blocks
                fileScore += Math.min(htmlInHbsCount, 3); // Add points for HTML tags in HBS
                fileScore -= Math.max(0, hbsCommentCount - 1); // Deduct points for excessive comments
                break;

            default:
                console.log(`No processing defined for file type: ${filePath}`);
        }

        // Normalize the score to be between 1 and 10
        fileScore = Math.max(1, Math.min(10, fileScore));
        scores[filePath] = fileScore;
    });

    console.log('Code complexity scores based on coding level:');
    console.log(scores);

    console.log('Code quality checks completed successfully.');

} catch (error) {
    console.error('Error during analysis:', error.message);
}
