document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput');
    const filesSection = document.getElementById('filesSection');
    const fileList = document.getElementById('fileList');
    const clearFilesBtn = document.getElementById('clearFiles');
    const convertBtn = document.getElementById('convertBtn');
    const resultsSection = document.getElementById('resultsSection');
    const resultList = document.getElementById('resultList');
    const downloadAllBtn = document.getElementById('downloadAll');
    const newConversionBtn = document.getElementById('newConversion');
    const errorsSection = document.getElementById('errorsSection');
    const errorList = document.getElementById('errorList');

    // State
    let selectedFiles = [];
    let currentSessionId = null;

    // Helper: format file size
    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' Б';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
        return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
    }

    // Drag & Drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('drag-over');
    });

    uploadZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
    });

    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('drag-over');
        handleFiles(e.dataTransfer.files);
    });

    // Click to upload
    uploadZone.addEventListener('click', (e) => {
        if (e.target.tagName !== 'INPUT') {
            fileInput.click();
        }
    });

    fileInput.addEventListener('change', (e) => {
        handleFiles(e.target.files);
    });

    // Handle selected files
    function handleFiles(files) {
        const htmlFiles = Array.from(files).filter(f => 
            f.name.toLowerCase().endsWith('.html') || 
            f.name.toLowerCase().endsWith('.htm')
        );

        if (htmlFiles.length === 0) {
            alert('Выберите HTML-файлы (.html или .htm)');
            return;
        }

        selectedFiles = [...selectedFiles, ...htmlFiles];
        renderFileList();
        filesSection.style.display = 'block';
        resultsSection.style.display = 'none';
        errorsSection.style.display = 'none';
    }

    // Render file list
    function renderFileList() {
        fileList.innerHTML = selectedFiles.map((file, index) => `
            <li>
                <div class="file-info">
                    <div class="file-icon">📄</div>
                    <span class="file-name">${escapeHtml(file.name)}</span>
                    <span class="file-size">${formatSize(file.size)}</span>
                </div>
                <button class="file-remove" data-index="${index}" title="Удалить">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="18" y1="6" x2="6" y2="18"/>
                        <line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                </button>
            </li>
        `).join('');

        // Attach remove handlers
        fileList.querySelectorAll('.file-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.currentTarget.dataset.index);
                selectedFiles.splice(index, 1);
                renderFileList();
                if (selectedFiles.length === 0) {
                    filesSection.style.display = 'none';
                }
            });
        });
    }

    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Clear files
    clearFilesBtn.addEventListener('click', () => {
        selectedFiles = [];
        filesSection.style.display = 'none';
        fileInput.value = '';
    });

    // Convert
    convertBtn.addEventListener('click', async () => {
        if (selectedFiles.length === 0) return;

        // UI: loading state
        const btnText = convertBtn.querySelector('.btn-text');
        const btnLoader = convertBtn.querySelector('.btn-loader');
        btnText.textContent = 'Конвертация...';
        btnLoader.style.display = 'inline-block';
        convertBtn.disabled = true;

        try {
            const formData = new FormData();
            selectedFiles.forEach(file => {
                formData.append('files[]', file);
            });

            const response = await fetch('/convert', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Ошибка конвертации');
            }

            currentSessionId = data.session_id;
            renderResults(data.converted);
            
            if (data.errors && data.errors.length > 0) {
                renderErrors(data.errors);
            }

            filesSection.style.display = 'none';
            resultsSection.style.display = 'block';

        } catch (error) {
            alert('Ошибка: ' + error.message);
        } finally {
            btnText.textContent = 'Конвертировать';
            btnLoader.style.display = 'none';
            convertBtn.disabled = false;
        }
    });

    // Render results
    function renderResults(converted) {
        resultList.innerHTML = converted.map(file => `
            <li>
                <div class="file-info">
                    <div class="file-icon">📕</div>
                    <span class="file-name">${escapeHtml(file.pdf)}</span>
                </div>
                <a href="/download/${file.session_id}/${encodeURIComponent(file.pdf)}" 
                   class="btn-download" download>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7 10 12 15 17 10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                    </svg>
                    Скачать
                </a>
            </li>
        `).join('');

        // Update download all button
        downloadAllBtn.onclick = () => {
            window.location.href = `/download-all/${currentSessionId}`;
        };
    }

    // Render errors
    function renderErrors(errors) {
        errorsSection.style.display = 'block';
        errorList.innerHTML = errors.map(err => `<li>${escapeHtml(err)}</li>`).join('');
    }

    // New conversion
    newConversionBtn.addEventListener('click', () => {
        // Cleanup old session
        if (currentSessionId) {
            fetch(`/cleanup/${currentSessionId}`, { method: 'POST' });
        }

        selectedFiles = [];
        currentSessionId = null;
        fileInput.value = '';
        resultsSection.style.display = 'none';
        errorsSection.style.display = 'none';
        uploadZone.scrollIntoView({ behavior: 'smooth' });
    });
});
