const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, '../frontend/src/pages');

const protectedBackgrounds = [
    'bg-blue-', 'bg-red-', 'bg-emerald-', 'bg-amber-', 'bg-green-', 'bg-orange-',
    'bg-purple-', 'bg-indigo-', 'bg-violet-', 'from-emerald', 'from-blue', 'from-indigo',
    'bg-[#3B82F6]', 'bg-admin-accent', 'gradient-to', 'bg-[#10192D]', 'bg-[#111827]', 'bg-[#1C2540]', 'bg-admin-elevated', 'bg-admin-surface'
];
// Wait, bg-admin-surface and bg-admin-elevated ARE light backgrounds in light theme, so text SHOULD be dark!
// The user explicitly said: "Only fix white text that appears on light backgrounds, cards, table rows... Keep text-white only where the background is always dark/colored... for example blue primary buttons... For neutral/light buttons in light theme, use dark text."
// So bg-admin-elevated, bg-admin-surface, bg-admin-bg are NOT protected backgrounds!

const actualProtectedBackgrounds = [
    'bg-blue-', 'bg-red-', 'bg-emerald-', 'bg-amber-', 'bg-green-', 'bg-orange-',
    'bg-purple-', 'bg-indigo-', 'bg-violet-', 'from-emerald', 'from-blue', 'from-indigo',
    'bg-[#3B82F6]', 'bg-admin-accent', 'gradient-to', 'bg-emerald-500'
];

fs.readdir(directoryPath, (err, files) => {
    if (err) return console.log('Unable to scan directory: ' + err);

    files.forEach((file) => {
        if (file.startsWith('Admin') && file.endsWith('.js')) {
            const filePath = path.join(directoryPath, file);
            let content = fs.readFileSync(filePath, 'utf8');

            let lines = content.split('\n');
            let newLines = lines.map(line => {
                // If line doesn't contain text-white, ignore
                if (!line.includes('text-white')) return line;

                // Check if the line has a protected background
                const hasProtectedBg = actualProtectedBackgrounds.some(bg => line.includes(bg));
                
                // Special edge cases where text-white is used but shouldn't be touched, e.g., if there's no className (maybe it's a comment)
                if (!line.includes('className')) return line;

                if (!hasProtectedBg) {
                    // Check if heading sizing is present
                    const isHeading = /text-(xl|2xl|3xl|4xl|5xl|lg)/.test(line) || /<h[123456]/.test(line);
                    const replacement = isHeading ? 'text-admin-heading' : 'text-admin-text';
                    
                    // Replace all text-white on this line
                    return line.replace(/\btext-white\b/g, replacement);
                }

                return line;
            });

            content = newLines.join('\n');
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Updated ${file}`);
        }
    });
});
