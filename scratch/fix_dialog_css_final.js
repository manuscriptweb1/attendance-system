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

            // Fix overlays
            if (content.includes('bg-admin-overlay backdrop-blur-sm')) {
                content = content.replace(/bg-admin-overlay backdrop-blur-sm/g, 'admin-overlay backdrop-blur-sm');
                modified = true;
            }
            if (content.includes('bg-slate-900/50 backdrop-blur-sm')) {
                content = content.replace(/bg-slate-900\/50 backdrop-blur-sm/g, 'admin-overlay backdrop-blur-sm');
                modified = true;
            }

            // Fix modals
            if (content.includes('bg-admin-modal border border-admin-border rounded-2xl shadow-clay-admin-modal')) {
                content = content.replace(/bg-admin-modal border border-admin-border rounded-2xl shadow-clay-admin-modal/g, 'admin-modal rounded-2xl');
                modified = true;
            }
            if (content.includes('bg-admin-surface border border-admin-border rounded-2xl shadow-clay-admin-modal')) {
                content = content.replace(/bg-admin-surface border border-admin-border rounded-2xl shadow-clay-admin-modal/g, 'admin-modal rounded-2xl');
                modified = true;
            }
            if (content.includes('bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scaleIn border border-slate-100')) {
                content = content.replace(/bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-scaleIn border border-slate-100/g, 'admin-modal rounded-2xl w-full max-w-md overflow-hidden animate-scaleIn');
                modified = true;
            }

            // Fix headings/text
            if (content.includes('text-slate-800')) {
                content = content.replace(/text-slate-800/g, 'text-admin-heading');
                modified = true;
            }
            if (content.includes('text-slate-600')) {
                content = content.replace(/text-slate-600/g, 'text-admin-text');
                modified = true;
            }
            
            // Fix input in PromptDialog or ClearDataDialog
            if (content.includes('bg-slate-800 border-slate-700 text-white')) {
                content = content.replace(/bg-slate-800 border-slate-700 text-white/g, 'admin-input');
                modified = true;
            }
            if (content.includes('bg-admin-surface border-admin-border text-admin-text')) {
                content = content.replace(/bg-admin-surface border-admin-border text-admin-text/g, 'admin-input');
                modified = true;
            }
            if (content.includes('bg-white/5 border border-admin-border text-admin-text')) {
                content = content.replace(/bg-white\/5 border border-admin-border text-admin-text/g, 'admin-input');
                modified = true;
            }
            if (content.includes('bg-white/5 border border-admin-border')) {
                content = content.replace(/bg-white\/5 border border-admin-border/g, 'admin-input');
                modified = true;
            }
            
            // Fix ClearDataDialog red background
            if (content.includes('bg-red-500/10 border border-red-500/20 text-red-400')) {
                content = content.replace(/bg-red-500\/10 border border-red-500\/20 text-red-400/g, 'bg-red-50 border border-red-200 text-red-600');
                modified = true;
            }
            
            if (modified) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Updated ${file}`);
            }
        }
    });
});
