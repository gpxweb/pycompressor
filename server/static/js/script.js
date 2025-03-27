document.addEventListener('DOMContentLoaded', function() {
    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const uploadForm = document.getElementById('upload-form');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const statusText = document.getElementById('status-text');
    const resultsContainer = document.getElementById('results-container');
    const uploadContainer = document.getElementById('upload-container');
    const compressBtn = document.getElementById('compress-btn');
    const downloadBtn = document.getElementById('download-btn');
    const newFileBtn = document.getElementById('new-file-btn');
    const fileNameSpan = document.getElementById('file-name');
    const originalSizeSpan = document.getElementById('original-size');
    const compressedSizeSpan = document.getElementById('compressed-size');
    const reductionPercentSpan = document.getElementById('reduction-percent');
    const compressionRatioSpan = document.getElementById('compression-ratio');
    const errorContainer = document.getElementById('error-container');
    const errorText = document.getElementById('error-text');

    let currentFileId = null;
    let currentFileName = null;

    // Prevent default behavior for drag events
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight drop area when dragging file over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight() {
        dropArea.classList.add('highlight');
    }

    function unhighlight() {
        dropArea.classList.remove('highlight');
    }

    // Handle dropped files
    dropArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        
        if (files.length > 0) {
            fileInput.files = files;
            handleFileSelected();
        }
    }

    // Handle file selection from file input
    fileInput.addEventListener('change', handleFileSelected);

    function handleFileSelected() {
        if (fileInput.files.length === 0) return;
        
        const file = fileInput.files[0];
        
        // Check if it's a PDF
        if (!file.name.toLowerCase().endsWith('.pdf')) {
            showError('Please select a PDF file');
            fileInput.value = '';
            return;
        }
        
        // Hide any previous errors
        hideError();
        
        // Show the file name
        fileNameSpan.textContent = file.name;
        currentFileName = file.name;
        
        // Upload the file
        uploadFile(file);
    }

    // Upload the file to the server
    function uploadFile(file) {
        // Create FormData object
        const formData = new FormData();
        formData.append('file', file);
        
        // Show progress container
        progressContainer.classList.remove('d-none');
        uploadContainer.classList.add('d-none');
        resultsContainer.classList.add('d-none');
        
        // Update status
        statusText.textContent = 'Uploading...';
        progressBar.style.width = '25%';
        progressBar.setAttribute('aria-valuenow', 25);
        
        // Send the upload request
        fetch('/upload', {
            method: 'POST',
            body: formData
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || 'Upload failed');
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                currentFileId = data.fileId;
                originalSizeSpan.textContent = data.originalSize;
                
                // Update progress
                statusText.textContent = 'Upload complete. Ready to compress!';
                progressBar.style.width = '50%';
                progressBar.setAttribute('aria-valuenow', 50);
                
                // Show compress button
                compressBtn.classList.remove('d-none');
            } else {
                throw new Error(data.error || 'Upload failed');
            }
        })
        .catch(error => {
            showError(error.message);
            resetUploadForm();
        });
    }

    // Compress the uploaded file
    compressBtn.addEventListener('click', function() {
        if (!currentFileId) return;
        
        // Update status
        statusText.textContent = 'Compressing...';
        progressBar.style.width = '75%';
        progressBar.setAttribute('aria-valuenow', 75);
        
        // Hide compress button
        compressBtn.classList.add('d-none');
        
        // Send the compress request
        fetch('/compress', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                fileId: currentFileId
            })
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(data => {
                    throw new Error(data.error || 'Compression failed');
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                // Update progress
                statusText.textContent = 'Compression complete!';
                progressBar.style.width = '100%';
                progressBar.setAttribute('aria-valuenow', 100);
                
                // Show results
                originalSizeSpan.textContent = data.originalSize;
                compressedSizeSpan.textContent = data.compressedSize;
                reductionPercentSpan.textContent = data.percentReduction;
                compressionRatioSpan.textContent = data.compressionRatio;
                
                // Show results container and download button
                setTimeout(() => {
                    progressContainer.classList.add('d-none');
                    resultsContainer.classList.remove('d-none');
                    downloadBtn.classList.remove('d-none');
                    newFileBtn.classList.remove('d-none');
                }, 1000);
            } else {
                throw new Error(data.error || 'Compression failed');
            }
        })
        .catch(error => {
            showError(error.message);
            resetUploadForm();
        });
    });

    // Download the compressed file
    downloadBtn.addEventListener('click', function() {
        if (!currentFileId) return;
        
        // Create download link
        const downloadUrl = `/download/${currentFileId}`;
        
        // Create a temporary link and trigger download
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = currentFileName.replace('.pdf', '_compressed.pdf');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Handle new file button
    newFileBtn.addEventListener('click', function() {
        resetUploadForm();
    });

    // Reset the upload form
    function resetUploadForm() {
        fileInput.value = '';
        currentFileId = null;
        currentFileName = null;
        
        progressContainer.classList.add('d-none');
        resultsContainer.classList.add('d-none');
        uploadContainer.classList.remove('d-none');
        
        compressBtn.classList.add('d-none');
        downloadBtn.classList.add('d-none');
        newFileBtn.classList.add('d-none');
        
        progressBar.style.width = '0%';
        progressBar.setAttribute('aria-valuenow', 0);
        statusText.textContent = '';
    }

    // Show error message
    function showError(message) {
        errorText.textContent = message;
        errorContainer.classList.remove('d-none');
    }

    // Hide error message
    function hideError() {
        errorContainer.classList.add('d-none');
    }
});
