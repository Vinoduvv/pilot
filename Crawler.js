const fs = require('fs');
const path = require('path');
const espree = require('espree');

// Load configuration from config.json
const config = JSON.parse(fs.readFileSync('config.json', 'utf-8'));

const authors = config.authors;
const branch = config.branch;
const startDate = config.startDate;
const endDate = config.endDate;

// UI extensions supported for complexity analysis
const uiExtensions = ['.html', '.htm', '.css', '.scss', '.sass', '.js', '.jsx', '.ts', '.tsx', '.vue', '.hbs', '.svg', '.md'];

// Utility function to execute shell commands
function runCommand(command) {
    try {
        return require('child_process').execSync(command).toString().trim();
    } catch (err) {
        console.error(`Error running command: ${command}`);
        return '';
    }
}

// Function to get commits by a specific author
function getCommitsByAuthor(email) {
    const command = `git log ${branch} --author="${email}" --since="${startDate}" --until="${endDate}" --pretty=format:"%H"`;
    return runCommand(command).split('\n').filter(commit => commit);
}

// Function to get files changed in a commit
function getFilesChangedInCommit(commitHash) {
    const command = `git diff-tree --no-commit-id --name-only -r ${commitHash}`;
    return runCommand(command).split('\n').filter(file => file);
}

// Parse JavaScript/TypeScript file into AST for complexity analysis
function parseFileToAST(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    return espree.parse(fileContent, { ecmaVersion: 2020, sourceType: 'module' });
}

// Calculate complexity (lines of code) for each file type
function calculateComplexity(fileContent, fileType) {
    const linesOfCode = fileContent.split('\n').length;

    // Cyclomatic complexity for JS/TS files
    let cyclomaticComplexity = 1;
    if (['.js', '.jsx', '.ts', '.tsx'].includes(fileType)) {
        const ast = parseFileToAST(fileContent);
        cyclomaticComplexity = analyzeCyclomaticComplexity(ast);
    }

    return {
        linesOfCode,
        cyclomaticComplexity,
        fileType,
    };
}

// Calculate cyclomatic complexity for JavaScript/TypeScript files
function analyzeCyclomaticComplexity(ast) {
    let complexity = 1;
    function traverse(node) {
        switch (node.type) {
            case 'IfStatement':
            case 'ForStatement':
            case 'WhileStatement':
            case 'SwitchCase':
                complexity += 1;
                break;
        }
        for (const key in node) {
            if (node[key] && typeof node[key] === 'object') {
                traverse(node[key]);
            }
        }
    }
    traverse(ast);
    return complexity;
}

// Analyze files changed in commits
function analyzeFiles(filesChanged) {
    const report = [];
    
    filesChanged.forEach(file => {
        const ext = path.extname(file);
        if (uiExtensions.includes(ext)) {
            const filePath = path.resolve(file);
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf-8');
                const complexityReport = calculateComplexity(content, ext);
                report.push(complexityReport);
            }
        }
    });
    
    return report;
}

// Generate a report for an author
function generateAuthorReport(authorEmail) {
    const commits = getCommitsByAuthor(authorEmail);
    const report = [];

    commits.forEach(commitHash => {
        const filesChanged = getFilesChangedInCommit(commitHash);
        const fileReport = analyzeFiles(filesChanged);
        report.push({ commitHash, files: fileReport });
    });

    return { authorEmail, report };
}

// Generate the overall report
function generateReport() {
    const authorReports = authors.map(authorEmail => generateAuthorReport(authorEmail));

    console.log('Author Report:');
    authorReports.forEach(authorReport => {
        console.log(`\nAuthor: ${authorReport.authorEmail}`);
        authorReport.report.forEach(commitReport => {
            console.log(`Commit: ${commitReport.commitHash}`);
            commitReport.files.forEach(fileReport => {
                console.log(`File: ${fileReport.fileType}`);
                console.log(`Lines of Code: ${fileReport.linesOfCode}`);
                console.log(`Cyclomatic Complexity: ${fileReport.cyclomaticComplexity}`);
            });
        });
    });

    // Save the report to a file
    fs.writeFileSync('ui_complexity_report.json', JSON.stringify(authorReports, null, 2), 'utf-8');
}

// Start the report generation
generateReport();
