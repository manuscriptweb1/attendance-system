const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, '../frontend/src/pages');

fs.readdir(directoryPath, (err, files) => {
    if (err) return console.log('Unable to scan directory: ' + err);

    files.forEach((file) => {
        if (file.startsWith('Admin') && file.endsWith('.js')) {
            const filePath = path.join(directoryPath, file);
            let content = fs.readFileSync(filePath, 'utf8');

            // 1. Modals Background (Overlays)
            content = content.replace(/bg-black\/70 backdrop-blur-sm/g, 'bg-admin-overlay backdrop-blur-sm');
            content = content.replace(/bg-admin-bg backdrop-blur-md/g, 'bg-admin-overlay backdrop-blur-sm');

            // 2. Modal Containers (bg-admin-surface for modals usually)
            // It's tricky to find only modal containers. We will look for common modal container classes:
            content = content.replace(/bg-admin-surface border border-admin-border rounded-2xl w-full max-w-md/g, 'bg-admin-modal text-admin-modal-text border border-admin-border rounded-2xl w-full max-w-md');
            content = content.replace(/bg-admin-surface border border-admin-border rounded-2xl p-6/g, 'bg-admin-modal text-admin-modal-text border border-admin-border rounded-2xl p-6');

            // 3. Select / Options
            // Replace <option value="..." className="bg-admin-elevated text-admin-text">
            // Or similar
            content = content.replace(/className=["']bg-admin-elevated text-[^"']*["']/g, 'className="admin-dropdown-option bg-admin-dropdown text-admin-dropdown-text"');
            content = content.replace(/className=["']bg-admin-surface text-[^"']*["']/g, 'className="admin-dropdown-option bg-admin-dropdown text-admin-dropdown-text"');
            
            // For native selects that use admin-select but have custom bg colors on options
            content = content.replace(/className=["']bg-admin-bg text-[^"']*["']/g, 'className="admin-dropdown-option bg-admin-dropdown text-admin-dropdown-text"');

            // Add admin-input to inputs that have bg-admin-bg
            content = content.replace(/<input([^>]*?)className=["'`]([^"'`]*)bg-admin-bg([^"'`]*)["'`]/g, (match, before, p1, p2) => {
                if (p1.includes('admin-input')) return match; // already has it
                return `<input${before}className="${p1}admin-input bg-admin-input-bg${p2}"`;
            });
            content = content.replace(/<select([^>]*?)className=["'`]([^"'`]*)bg-admin-bg([^"'`]*)["'`]/g, (match, before, p1, p2) => {
                if (p1.includes('admin-select')) return match; // already has it
                return `<select${before}className="${p1}admin-select bg-admin-input-bg${p2}"`;
            });

            // Same for bg-white/5 in manual attendance
            content = content.replace(/<input([^>]*?)className=["'`]([^"'`]*)bg-white\/5([^"'`]*)["'`]/g, (match, before, p1, p2) => {
                return `<input${before}className="${p1}admin-input${p2}"`;
            });
            content = content.replace(/<select([^>]*?)className=["'`]([^"'`]*)bg-white\/5([^"'`]*)["'`]/g, (match, before, p1, p2) => {
                return `<select${before}className="${p1}admin-select${p2}"`;
            });

            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Updated ${file}`);
        }
    });
});
