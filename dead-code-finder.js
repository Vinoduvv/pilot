const esprima = require('esprima');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Track results for CSV generation
const results = [];

// Helper function to scan directories recursively for JS or TS files
function scanDirectory(directory, fileList = []) {
  const files = fs.readdirSync(directory);

  files.forEach((file) => {
    const filePath = path.join(directory, file);
    
    // Skip node_modules and other unwanted directories
    if (fs.statSync(filePath).isDirectory()) {
      if (!filePath.includes('node_modules')) {
        scanDirectory(filePath, fileList);
      }
    } else if (filePath.endsWith('.js') || filePath.endsWith('.ts')) {
      // If it's a JS or TS file, add it to the file list
      fileList.push(filePath);
    }
  });
  return fileList;
}

// Function to parse JavaScript/TypeScript files and detect dead code
function analyzeFile(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const ast = esprima.parseScript(code, { tolerant: true, range: true });
  const declaredIdentifiers = new Set();
  const usedIdentifiers = new Set();

  // Traverse AST nodes to detect declarations and usage
  function traverseNode(node) {
    switch (node.type) {
      case 'VariableDeclarator':
        declaredIdentifiers.add(node.id.name);
        break;
      case 'FunctionDeclaration':
        declaredIdentifiers.add(node.id.name);
        break;
      case 'Identifier':
        if (!declaredIdentifiers.has(node.name)) {
          usedIdentifiers.add(node.name);
        }
        break;
      default:
        break;
    }

    // Recursively traverse child nodes
    for (let key in node) {
      if (node[key] && typeof node[key] === 'object') {
        traverseNode(node[key]);
      }
    }
  }

  // Start traversing the AST
  ast.body.forEach(traverseNode);

  // Detect unused identifiers (declared but not used)
  const unusedIdentifiers = [...declaredIdentifiers].filter(
    (id) => !usedIdentifiers.has(id)
  );

  if (unusedIdentifiers.length > 0) {
    console.log(`Unused identifiers found in ${filePath}:`, unusedIdentifiers);

    // Save result for CSV report
    results.push({
      filePath,
      unusedIdentifiers: unusedIdentifiers.join(', ')
    });
  }
}

// Function to write the CSV report manually
function writeCsvReport() {
  const csvFilePath = 'dead-code-report.csv';
  const header = 'File Path,Unused Identifiers\n';
  const rows = results.map(result => `${result.filePath},"${result.unusedIdentifiers}"`).join('\n');
  const csvContent = header + rows;

  fs.writeFileSync(csvFilePath, csvContent, 'utf8');
  console.log(`CSV report generated: ${csvFilePath}`);
}

// Main function to scan a directory and analyze each JavaScript/TypeScript file
function detectDeadCode(directory, verbose = false) {
  console.log(`Scanning directory: ${directory}`);
  const startTime = performance.now();

  const files = scanDirectory(directory);
  files.forEach((file) => {
    if (verbose) {
      console.log(`Analyzing: ${file}`);
    }
    analyzeFile(file);
  });

  const endTime = performance.now();
  const scanTime = ((endTime - startTime) / 1000).toFixed(2);
  console.log(`Dead code detection complete. Time taken: ${scanTime} seconds`);

  // Generate CSV report if there are results
  if (results.length > 0) {
    writeCsvReport();
  } else {
    console.log('No dead code found. No CSV report generated.');
  }
}

// Start dead code detection by providing the root directory to scan
const targetDirectory = './src'; // Change this to your project directory
const verboseMode = true; // Set this to true for detailed logs, false for a silent scan

detectDeadCode(targetDirectory, verboseMode);
