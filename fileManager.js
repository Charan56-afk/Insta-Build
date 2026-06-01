// File Manager - Handles file CRUD operations
class FileManager {
    constructor(projectId) {
        this.projectId = projectId || 'default';
    }

    async getFiles() {
        const res = await fetch(`/api/ide/files/${this.projectId}`);
        return res.json();
    }

    async saveFile(path, content) {
        const res = await fetch(`/api/ide/files/${this.projectId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ path, content })
        });
        return res.json();
    }

    async deleteFile(path) {
        const res = await fetch(`/api/ide/files/${this.projectId}/${encodeURIComponent(path)}`, {
            method: 'DELETE'
        });
        return res.json();
    }

    async getPreview() {
        const res = await fetch(`/api/ide/preview/${this.projectId}`);
        return res.text();
    }

    getFileIcon(path) {
        const ext = path.split('.').pop().toLowerCase();
        const icons = {
            html: 'fa-file-code',
            css: 'fa-file-code',
            js: 'fa-file-code',
            json: 'fa-file-code',
            py: 'fa-file-code',
            ts: 'fa-file-code',
            md: 'fa-file-alt',
            txt: 'fa-file-alt',
        };
        return icons[ext] || 'fa-file';
    }

    getLanguageFromPath(path) {
        const ext = path.split('.').pop().toLowerCase();
        const langMap = {
            js: 'javascript',
            html: 'html',
            css: 'css',
            json: 'json',
            py: 'python',
            ts: 'typescript',
            jsx: 'javascript',
            tsx: 'typescript',
            xml: 'xml',
            sql: 'sql'
        };
        return langMap[ext] || 'plaintext';
    }
}
