const fs = require('fs');
const path = require('path');

const directoryPath = path.join(__dirname, '../frontend/src/pages');

// List of strings that indicate a colored background
const protectedBackgrounds = [
    'bg-blue-', 'bg-red-', 'bg-emerald-', 'bg-amber-', 'bg-green-', 'bg-orange-',
    'bg-purple-', 'bg-indigo-', 'bg-violet-', 'from-emerald', 'from-blue',
    'bg-[#3B82F6]', 'bg-admin-accent', 'gradient-to'
];

fs.readdir(directoryPath, (err, files) => {
    if (err) {
        return console.log('Unable to scan directory: ' + err);
    }

    files.forEach((file) => {
        if (file.startsWith('Admin') && file.endsWith('.js')) {
            const filePath = path.join(directoryPath, file);
            let content = fs.readFileSync(filePath, 'utf8');

            // Find all className strings that contain text-white
            // This regex matches className="...", className={'...'}, className={`...`}
            // We use a replacer function to analyze the content of the className
            const classRegex = /className=(?:\{`([^`]+)`\}|"([^"]+)"|'([^']+)'|\{(?:[^`"']*)?['"]([^'"]+)['"](?:[^`"']*)?\})/g;

            content = content.replace(classRegex, (match, p1, p2, p3, p4) => {
                const classStr = p1 || p2 || p3 || p4 || "";
                
                // If it doesn't have text-white, return unchanged
                if (!classStr.includes('text-white')) {
                    return match;
                }

                // Check if the class string contains a protected background
                const hasProtectedBg = protectedBackgrounds.some(bg => classStr.includes(bg));

                if (hasProtectedBg) {
                    // Keep text-white for colored buttons/badges
                    return match;
                }

                // Decide whether it's a heading or normal text
                // Since our regex only captured the class string, not the tag, we can look at the text sizing
                // or we can just replace text-white with text-admin-heading if we see text-xl, text-2xl, etc.
                let replacement = 'text-admin-text';
                if (classStr.includes('text-xl') || classStr.includes('text-2xl') || classStr.includes('text-3xl') || classStr.includes('text-4xl') || classStr.includes('text-lg')) {
                    replacement = 'text-admin-heading';
                }

                const newClassStr = classStr.replace(/\btext-white\b/g, replacement);
                
                // Reconstruct the match by replacing the old classStr with newClassStr
                // Because of template literals with expressions like className={`... ${expr}`}, this naive replacement
                // inside the captured group is safer.
                return match.replace('text-white', replacement);
            });

            // Replace stray text-white that might have been missed due to complex expressions
            // But only if we are absolutely sure. Actually, let's just run another pass specifically for headings
            content = content.replace(/<h[123456][^>]*className=["'`{][^>"'`}]*text-white/g, (match) => {
                // If we missed it, it's a heading, so replace it with text-admin-heading
                return match.replace('text-white', 'text-admin-heading');
            });
            
            // For other simple classes not caught by the complex regex
            content = content.replace(/className="([^"]*?)\btext-white\b([^"]*?)"/g, (match, before, after) => {
                 const classStr = before + after;
                 const hasProtectedBg = protectedBackgrounds.some(bg => classStr.includes(bg));
                 if (hasProtectedBg) return match;
                 
                 let replacement = 'text-admin-text';
                 if (classStr.includes('text-xl') || classStr.includes('text-2xl') || classStr.includes('text-3xl') || classStr.includes('text-lg')) {
                     replacement = 'text-admin-heading';
                 }
                 return `className="${before}${replacement}${after}"`;
            });

            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`Updated ${file}`);
        }
    });
});
