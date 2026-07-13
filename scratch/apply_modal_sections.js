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

            // 1. Remove border-admin-border and border-[#E2E8F0] from header and footer 
            // and add admin-modal-header, admin-modal-body, admin-modal-footer
            
            // AlertDialog.js, ConfirmDialog.js, DetailsDialog.js, PromptDialog.js, LocationDialog.js, LogoutWarningDialog.js
            
            // Header
            if (content.includes('px-6 py-5 border-b border-admin-border')) {
                content = content.replace(/className="(flex items-start justify-between |flex justify-between items-center )px-6 py-5 border-b border-admin-border"/g, 'className="admin-modal-header $1px-6 py-5 border-b"');
                modified = true;
            }
            if (content.includes('px-6 py-5 border-b border-[#E2E8F0]')) {
                content = content.replace(/className="(flex items-start justify-between |flex justify-between items-center )px-6 py-5 border-b border-\[#E2E8F0\]"/g, 'className="admin-modal-header $1px-6 py-5 border-b"');
                modified = true;
            }

            // Body
            if (content.includes('className="px-6 py-5"')) {
                content = content.replace(/className="px-6 py-5"/g, 'className="admin-modal-body px-6 py-5"');
                modified = true;
            }
            if (content.includes('className="p-6"')) {
                content = content.replace(/className="p-6"/g, 'className="admin-modal-body p-6"');
                modified = true;
            }

            // Footer
            if (content.includes('px-6 py-4 border-t border-admin-border')) {
                content = content.replace(/className="(flex justify-end |flex items-center justify-end gap-3 )px-6 py-4 border-t border-admin-border\s*(rounded-b-2xl|)"/g, 'className="admin-modal-footer $1px-6 py-4 border-t"');
                modified = true;
            }
            if (content.includes('px-6 py-4 border-t border-[#E2E8F0]')) {
                content = content.replace(/className="(flex justify-end |flex items-center justify-end gap-3 )px-6 py-4 border-t border-\[#E2E8F0\]\s*(bg-\[#F8FAFC\] |)(rounded-b-2xl|)"/g, 'className="admin-modal-footer $1px-6 py-4 border-t"');
                modified = true;
            }
            if (content.includes('className="flex gap-3 justify-end"')) {
                content = content.replace(/className="flex gap-3 justify-end"/g, 'className="admin-modal-footer flex gap-3 justify-end mt-6"');
                modified = true;
            }

            // Global error dialog has its own structure
            if (file === 'GlobalErrorDialog.js') {
                if (content.includes('className="p-6"')) {
                    // Body is wrapped in p-6
                    content = content.replace('className="p-6"', 'className="admin-modal-body p-6"');
                    modified = true;
                }
            }

            if (modified) {
                fs.writeFileSync(filePath, content, 'utf8');
                console.log(`Updated ${file}`);
            }
        }
    });
});
