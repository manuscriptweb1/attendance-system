const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, '../frontend/src/pages');

function processFiles() {
  fs.readdir(directoryPath, (err, files) => {
    if (err) return console.log('Unable to scan directory: ' + err);

    files.filter(f => f.startsWith('Admin') && f.endsWith('.js')).forEach(file => {
      const filePath = path.join(directoryPath, file);
      let content = fs.readFileSync(filePath, 'utf8');

      // 1. Add import AdminToast
      if (!content.includes("import AdminToast")) {
        content = content.replace(
          /(import AlertDialog from '..\/components\/AlertDialog';)/,
          "$1\nimport AdminToast from '../components/AdminToast';"
        );
      }

      // 2. Add toastConfig state
      if (!content.includes("const [toastConfig, setToastConfig]")) {
        content = content.replace(
          /(const \[alertDialog,(\s*)setAlertDialog\](\s*)=(\s*)useState\(\{.*\}\);)/,
          "$1\n  const [toastConfig, setToastConfig] = useState({ message: '', type: 'success' });"
        );
      }

      // 3. Replace setAlertDialog Success calls (handle spacing issues)
      const regex = /setAlertDialog\(\{\s*isOpen:\s*true,\s*title:\s*'Success',\s*message:\s*([^,]+),\s*type:\s*'success'\s*\}\)/g;
      
      content = content.replace(regex, "setToastConfig({ message: $1, type: 'success' })");

      // 4. Add <AdminToast /> at the end of the file, before the last </div>
      if (!content.includes("<AdminToast")) {
        const toastStr = `\n      <AdminToast \n        message={toastConfig.message} \n        type={toastConfig.type} \n        onClose={() => setToastConfig({ message: '', type: 'success' })} \n      />\n    </div>\n  );\n};`;
        content = content.replace(/\n\s*<\/div>\n\s*\);\n\s*\};\s*$/, toastStr);
        
        // Sometimes components end with export default, but the closing is above it
        if (!toastStr.includes('export default')) {
          content = content.replace(/\n\s*<\/div>\n\s*\);\n\s*\};\n\s*export default/, `\n      <AdminToast \n        message={toastConfig.message} \n        type={toastConfig.type} \n        onClose={() => setToastConfig({ message: '', type: 'success' })} \n      />\n    </div>\n  );\n};\n\nexport default`);
        }
      }

      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Updated ${file}`);
    });
  });
}

processFiles();
