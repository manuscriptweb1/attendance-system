const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, '../frontend/src/components');

fs.readdir(directoryPath, (err, files) => {
    if (err) return console.log('Unable to scan directory: ' + err);

    files.forEach((file) => {
        if (file.endsWith('.js') && file.includes('Dialog')) {
            const filePath = path.join(directoryPath, file);
            let content = fs.readFileSync(filePath, 'utf8');
            let modified = false;

            if (content.includes('bg-admin-bg')) {
                // Remove bg-admin-bg from dialogs to match pure modal background
                content = content.replace(/bg-admin-bg/g, '');
                modified = true;
            }
            if (content.includes('backdrop-blur-md')) {
                content = content.replace(/backdrop-blur-md/g, '');
                modified = true;
            }

            if (modified) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Updated ${file}`);
            }
        }
    });
});
