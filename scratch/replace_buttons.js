const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, '../frontend/src/pages');

fs.readdir(directoryPath, (err, files) => {
    if (err) return console.log('Unable to scan directory: ' + err);

    files.forEach((file) => {
        if (file.endsWith('.js')) {
            const filePath = path.join(directoryPath, file);
            let content = fs.readFileSync(filePath, 'utf8');
            let modified = false;

            const targetClass = 'px-4 py-2 text-sm font-semibold text-slate-300 border border-admin-border rounded-xl hover:bg-white/5 transition-colors';
            if (content.includes(targetClass)) {
                content = content.split(targetClass).join('admin-btn-neutral rounded-xl px-4 py-2 text-sm font-semibold');
                modified = true;
            }

            const targetClass2 = 'w-8 h-8 rounded-lg flex items-center justify-center text-admin-secondary hover:bg-white/5 transition-colors';
            if (content.includes(targetClass2)) {
                content = content.split(targetClass2).join('w-8 h-8 rounded-lg flex items-center justify-center text-admin-secondary hover:bg-admin-elevated transition-colors');
                modified = true;
            }
            
            const targetClass3 = 'w-8 h-8 rounded-lg flex items-center justify-center text-admin-secondary hover:bg-white/5 hover:text-admin-secondary transition-colors';
            if (content.includes(targetClass3)) {
                content = content.split(targetClass3).join('w-8 h-8 rounded-lg flex items-center justify-center text-admin-secondary hover:bg-admin-elevated transition-colors');
                modified = true;
            }

            // Also check for clear and generate buttons
            // Generate button if neutral
            // PDF button, Clear button
            
            if (modified) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Updated ${file}`);
            }
        }
    });
});
