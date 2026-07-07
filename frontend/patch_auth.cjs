const fs = require('fs');
const path = require('path');

const pagesDir = path.join(__dirname, 'src', 'pages');
const files = fs.readdirSync(pagesDir).filter(f => f.endsWith('.tsx'));

for (const file of files) {
  const filePath = path.join(pagesDir, file);
  let content = fs.readFileSync(filePath, 'utf-8');

  if (content.includes('Bearer dummy')) {
    if (!content.includes('useAuth')) {
      if (content.includes('react-router-dom')) {
        content = content.replace(
          /import .* from "react-router-dom";?/, 
          match => `${match}\nimport { useAuth } from "../context/AuthContext";`
        );
      } else {
        content = `import { useAuth } from "../context/AuthContext";\n` + content;
      }
    }

    content = content.replace(
      /export default function (\w+)\(\) \{/,
      match => `${match}\n  const { token } = useAuth();\n`
    );

    content = content.replace(/"Authorization": "Bearer dummy"/g, '"Authorization": `Bearer ${token}`');
    content = content.replace(/'Authorization': 'Bearer dummy'/g, '"Authorization": `Bearer ${token}`');

    fs.writeFileSync(filePath, content);
    console.log(`Patched ${file}`);
  }
}
