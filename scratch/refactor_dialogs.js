const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, '../frontend/src/components');

fs.readdir(directoryPath, (err, files) => {
    if (err) return console.log('Unable to scan directory: ' + err);

    files.forEach((file) => {
        if (file.endsWith('.js')) {
            const filePath = path.join(directoryPath, file);
            let content = fs.readFileSync(filePath, 'utf8');
            let modified = false;

            if (content.includes('bg-[#1E293B]') || content.includes('bg-black/70')) {
                // Modals Background (Overlays)
                content = content.replace(/bg-black\/70 backdrop-blur-sm/g, 'bg-admin-overlay backdrop-blur-sm');
                content = content.replace(/bg-admin-bg backdrop-blur-md/g, 'bg-admin-overlay backdrop-blur-sm');

                // Modal Containers
                content = content.replace(/bg-\[#1E293B\]/g, 'bg-admin-modal');
                content = content.replace(/border-white\/10/g, 'border-admin-border');
                
                // Text colors
                content = content.replace(/text-white leading-tight/g, 'text-admin-heading leading-tight');
                content = content.replace(/text-white leading-relaxed/g, 'text-admin-modal-text leading-relaxed');
                
                // Close button
                content = content.replace(/text-gray-400 hover:bg-white\/5 hover:text-white/g, 'text-admin-muted hover:bg-admin-elevated hover:text-admin-text');
                
                // Footer
                content = content.replace(/bg-white\/5 rounded-b-2xl/g, 'bg-admin-bg rounded-b-2xl');
                content = content.replace(/bg-white\/5/g, 'bg-admin-bg');

                // Cancel button
                content = content.replace(/text-white border border-white\/20 rounded-xl hover:bg-white\/10/g, 'admin-btn-neutral px-4 py-2 text-sm font-semibold hover:text-red-500');

                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Updated ${file}`);
            }
        }
    });
});
