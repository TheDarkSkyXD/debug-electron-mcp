
import { generateClickByTextCommand } from '../src/utils/electron-commands';
import fs from 'fs';

// Check args
const targetText = process.argv[2] || 'Create New Item';
console.log(`Generating command for: "${targetText}"`);

let command = generateClickByTextCommand(targetText);

// Optional: Modify to return score debug info instead of clicking
if (process.argv.includes('--debug')) {
    console.log('Injecting debug mode (returns candidates without clicking)...');
    const debugCode = `
      // Return candidates for debugging
      return JSON.stringify(candidates.map(c => ({
        text: c.text,
        cleanText: c.text.replace(/\\s+/g, ' '),
        tagName: c.tag, 
        score: c.score,
        rect: c.rect
      })), null, 2);
    })()
`;

    // Wrap the whole thing in try-catch and replace end logic
    command = command.replace(/function\(\) \{/, 'function() { try {');
    command = command.replace(/if \(candidates\.length === 0\)[\s\S]+$/, debugCode + ' } catch(e) { return "Error: " + e.message; } })()');
}

const outFile = 'payload.js';
fs.writeFileSync(outFile, command, 'utf8');
console.log(`Command payload written to ${outFile}`);
console.log('You can now execute this using the eval command in MCP or via DevTools console.');
