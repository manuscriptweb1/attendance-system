const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, '../frontend/src/pages');

// Read all Admin files
fs.readdir(directoryPath, (err, files) => {
    if (err) {
        return console.log('Unable to scan directory: ' + err);
    }
    
    files.forEach((file) => {
        if (file.startsWith('Admin') && file.endsWith('.js')) {
            const filePath = path.join(directoryPath, file);
            let content = fs.readFileSync(filePath, 'utf8');
            
            // Backgrounds
            content = content.replace(/bg-\[#0E1320\](\/\d+)?/g, 'bg-admin-bg');
            content = content.replace(/bg-\[#070B1A\](\/\d+)?/g, 'bg-admin-bg');
            content = content.replace(/bg-\[#161D2E\](\/\d+)?/g, 'bg-admin-surface');
            content = content.replace(/bg-\[#1C2540\](\/\d+)?/g, 'bg-admin-elevated');
            content = content.replace(/bg-\[#0B1120\](\/\d+)?/g, 'bg-admin-elevated');
            content = content.replace(/bg-\[#10192D\](\/\d+)?/g, 'bg-admin-surface');
            content = content.replace(/bg-\[#050816\](\/\d+)?/g, 'bg-admin-bg');
            content = content.replace(/bg-\[#111827\](\/\d+)?/g, 'bg-admin-surface');
            content = content.replace(/bg-\[#0F172A\](\/\d+)?/g, 'bg-admin-elevated');
            content = content.replace(/focus:bg-\[#0F172A\](\/\d+)?/g, 'focus:bg-admin-elevated');

            // Borders
            content = content.replace(/border-white\/(?:10|5|[0-9]+|\[[0-9.]+\])/g, 'border-admin-border');
            
            // Text
            // We want to be careful not to replace text-white inside buttons if we want them to stay white.
            // But we can replace text-[#94A3B8], text-[#64748B], text-[#CBD5E1]
            content = content.replace(/text-\[#94A3B8\]/g, 'text-admin-muted');
            content = content.replace(/text-\[#64748B\]/g, 'text-admin-secondary');
            content = content.replace(/text-\[#CBD5E1\]/g, 'text-admin-secondary');
            // We can replace dark:text-white with text-admin-text if it exists next to text-[#0F172A]
            content = content.replace(/text-\[#0F172A\] dark:text-white/g, 'text-admin-text');

            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Updated ${file}`);
        }
    });
});
