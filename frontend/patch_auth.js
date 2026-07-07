const fs = require('fs');
const glob = require('glob'); // Note: we'll just read dir instead
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  if (content.includes('Bearer dummy')) {
    // Add import if not exists
    if (!content.includes('useAuth')) {
      content = content.replace(
        /import .* from "react-router-dom";?/, 
        match => `${match}\nimport { useAuth } from "../context/AuthContext";`
      );
      // Fallback if react-router-dom isn't imported
      if (!content.includes('../context/AuthContext')) {
        content = `import { useAuth } from "../context/AuthContext";\n` + content;
      }
    }

    // Insert const { token } = useAuth(); at the beginning of the default export function
    content = content.replace(
      /export default function (\w+)\(\) \{/,
      match => `${match}\n  const { token } = useAuth();\n`
    );

    // Replace Bearer dummy
    content = content.replace(/"Authorization": "Bearer dummy"/g, '"Authorization": `Bearer ${token}`');
    content = content.replace(/"Authorization": 'Bearer dummy'/g, '"Authorization": `Bearer ${token}`');

    fs.writeFileSync(filePath, content);
    console.log(`Patched ${file}`);
  }
}
