// Set up PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.7.107/pdf.worker.min.js';

// Debug Logging
function logDebug(message) {
    console.log(`[PDF Compressor] ${message}`);
}

logDebug('Script loaded');

document.addEventListener('DOMContentLoaded', function() {
    logDebug('DOM Content Loaded');

    const dropArea = document.getElementById('drop-area');
    const fileInput = document.getElementById('file-input');
    const uploadForm = document.getElementById('upload-form');
    const progressContainer = document.getElementById('progress-container');
    const progressBar = document.getElementById('progress-bar');
    const statusText = document.getElementById('status-text');
    const resultsContainer = document.getElementById('results-container');
    const uploadContainer = document.getElementById('upload-container');
    const downloadBtn = document.getElementById('download-btn');
    const newFileBtn = document.getElementById('new-file-btn');
    const fileNameSpan = document.getElementById('file-name');
    const originalSizeSpan = document.getElementById('original-size');
    const compressedSizeSpan = document.getElementById('compressed-size');
    const reductionPercentSpan = document.getElementById('reduction-percent');
    const compressionRatioSpan = document.getElementById('compression-ratio');
    const errorContainer = document.getElementById('error-container');
    const errorText = document.getElementById('error-text');

    let currentFileName = null;
    let originalPdfBytes = null;
    let compressedPdfBytes = null;

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
        
        // Check file size (100MB max)
        if (file.size > 100 * 1024 * 1024) {
            showError('File size exceeds the 100MB limit');
            fileInput.value = '';
            return;
        }
        
        // Hide any previous errors
        hideError();
        
        // Show the file name
        fileNameSpan.textContent = file.name;
        currentFileName = file.name;
        
        // Show file info and prepare for compression
        handleFileUpload(file);
    }

    // Process the selected file
    async function handleFileUpload(file) {
        try {
            // Show progress container
            progressContainer.classList.remove('d-none');
            uploadContainer.classList.add('d-none');
            resultsContainer.classList.add('d-none');
            
            // Update status
            statusText.textContent = 'Loading file...';
            progressBar.style.width = '25%';
            progressBar.setAttribute('aria-valuenow', 25);
            
            // Read file as array buffer
            const arrayBuffer = await readFileAsArrayBuffer(file);
            originalPdfBytes = new Uint8Array(arrayBuffer);
            
            // Calculate original size
            const originalSize = file.size / (1024 * 1024); // Size in MB
            originalSizeSpan.textContent = originalSize.toFixed(2);
            
            // Update progress
            statusText.textContent = 'Starting compression...';
            progressBar.style.width = '50%';
            progressBar.setAttribute('aria-valuenow', 50);
            
            // Start compression immediately
            startCompression();
        } catch (error) {
            showError('Error loading PDF: ' + error.message);
            resetUploadForm();
        }
    }
    
    // Function to start compression process
    async function startCompression() {
        if (!originalPdfBytes) {
            logDebug('No PDF bytes found to compress');
            showError('No PDF file loaded');
            resetUploadForm();
            return;
        }
        
        // Update status
        statusText.textContent = 'Compressing...';
        progressBar.style.width = '75%';
        progressBar.setAttribute('aria-valuenow', 75);
        
        try {
            logDebug('Starting PDF compression process');
            
            // Compress the PDF - always returns at least the original bytes
            compressedPdfBytes = await compressPdf(originalPdfBytes);
            
            // Calculate sizes
            const originalSize = originalPdfBytes.length / (1024 * 1024); // Size in MB
            const compressedSize = compressedPdfBytes.length / (1024 * 1024); // Size in MB
            const percentReduction = ((1 - (compressedSize / originalSize)) * 100).toFixed(2);
            const compressionRatio = (originalSize / Math.max(compressedSize, 0.01)).toFixed(2);
            
            logDebug(`Compression results: 
                Original size: ${originalSize.toFixed(2)} MB
                Compressed size: ${compressedSize.toFixed(2)} MB
                Reduction: ${percentReduction}%
                Ratio: ${compressionRatio}
            `);
            
            // Update UI
            originalSizeSpan.textContent = originalSize.toFixed(2);
            compressedSizeSpan.textContent = compressedSize.toFixed(2);
            reductionPercentSpan.textContent = percentReduction;
            compressionRatioSpan.textContent = compressionRatio;
            
            // Update progress
            statusText.textContent = 'Compression complete!';
            progressBar.style.width = '100%';
            progressBar.setAttribute('aria-valuenow', 100);
            
            logDebug('Showing compression results');
            
            // Show results container and download button
            setTimeout(() => {
                progressContainer.classList.add('d-none');
                resultsContainer.classList.remove('d-none');
                downloadBtn.classList.remove('d-none');
                newFileBtn.classList.remove('d-none');
            }, 1000);
        } catch (error) {
            logDebug(`Error during compression: ${error.message}`);
            console.error('Compression error:', error);
            
            // Even if compression fails, we can still offer the original file
            compressedPdfBytes = originalPdfBytes;
            
            // Calculate sizes (no compression)
            const size = originalPdfBytes.length / (1024 * 1024); // Size in MB
            
            // Update UI to show no compression occurred
            originalSizeSpan.textContent = size.toFixed(2);
            compressedSizeSpan.textContent = size.toFixed(2);
            reductionPercentSpan.textContent = "0";
            compressionRatioSpan.textContent = "1.00";
            
            // Update progress
            statusText.textContent = 'Compression skipped (error occurred)';
            progressBar.style.width = '100%';
            progressBar.setAttribute('aria-valuenow', 100);
            
            // Show results anyway so user can download the original file
            setTimeout(() => {
                progressContainer.classList.add('d-none');
                resultsContainer.classList.remove('d-none');
                downloadBtn.classList.remove('d-none');
                newFileBtn.classList.remove('d-none');
            }, 1000);
        }
    }

    // Read file as ArrayBuffer
    function readFileAsArrayBuffer(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    // We've removed the compress button and its event listener
    // Compression now starts automatically after file upload

    // Client-side PDF compression - aggressive but reliable version
    async function compressPdf(pdfBytes) {
        try {
            logDebug('Starting PDF compression');
            statusText.textContent = 'Compressing PDF...';
            
            // Validate input
            if (!pdfBytes || pdfBytes.length === 0) {
                logDebug('Invalid PDF bytes');
                throw new Error('Invalid PDF data');
            }
            
            try {
                // First validate the PDF by loading it with PDF.js
                logDebug('Validating PDF with PDF.js');
                let pageCount = 0;
                try {
                    const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
                    const pdfJsDoc = await loadingTask.promise;
                    pageCount = pdfJsDoc.numPages;
                    logDebug(`PDF validation successful: ${pageCount} pages`);
                } catch (pdfJsError) {
                    logDebug(`PDF validation failed: ${pdfJsError.message}`);
                    throw new Error(`Invalid PDF: ${pdfJsError.message}`);
                }
                
                // Try aggressive compression using page re-rendering approach first
                // This is especially effective for image-heavy PDFs
                try {
                    statusText.textContent = 'Performing deep compression...';
                    logDebug('Trying deep compression with re-rendering approach');
                    
                    const aggressiveCompressedBytes = await extractAndCompressImagesFromPDF(pdfBytes);
                    
                    // Validate the aggressively compressed PDF
                    try {
                        const checkTask = pdfjsLib.getDocument({ data: aggressiveCompressedBytes });
                        const checkDoc = await checkTask.promise;
                        
                        // Check if we got a good compression ratio and the page count is correct
                        if (checkDoc.numPages === pageCount && 
                            aggressiveCompressedBytes.length < pdfBytes.length * 0.7) { // At least 30% reduction
                            
                            const originalSize = pdfBytes.length / 1024 / 1024;
                            const compressedSize = aggressiveCompressedBytes.length / 1024 / 1024;
                            const percentReduction = ((1 - (compressedSize / originalSize)) * 100).toFixed(2);
                            
                            logDebug(`Deep compression successful! Reduced by ${percentReduction}%`);
                            logDebug(`Original: ${originalSize.toFixed(2)} MB, Compressed: ${compressedSize.toFixed(2)} MB`);
                            
                            return aggressiveCompressedBytes;
                        } else {
                            logDebug('Deep compression produced insufficient results, trying standard approach');
                        }
                    } catch (e) {
                        logDebug(`Deep compression validation failed: ${e.message}, trying standard approach`);
                    }
                } catch (e) {
                    logDebug(`Deep compression failed: ${e.message}, trying standard approach`);
                }
                
                // If we got here, try the standard PDF-Lib approach
                // Load the PDF document using pdf-lib for compression
                statusText.textContent = 'Optimizing document structure...';
                logDebug('Using standard PDF-lib compression');
                const pdfDoc = await PDFLib.PDFDocument.load(pdfBytes, { 
                    ignoreEncryption: true,
                    updateMetadata: false
                });
                
                // Get all pages
                const pages = pdfDoc.getPages();
                logDebug(`PDF has ${pages.length} pages`);
                
                // Apply more aggressive compression options
                logDebug('Applying more aggressive compression settings');
                const compressedPdfBytes = await pdfDoc.save({
                    useObjectStreams: true,
                    addDefaultPage: false,
                    updateMetadata: false,
                    objectsPerTick: 20, // Process fewer objects per tick for more thorough compression
                });
                
                // Check compression results
                const originalSize = pdfBytes.length / 1024 / 1024;
                const compressedSize = compressedPdfBytes.length / 1024 / 1024;
                const percentReduction = ((1 - (compressedSize / originalSize)) * 100).toFixed(2);
                
                logDebug(`Original size: ${originalSize.toFixed(2)} MB`);
                logDebug(`Compressed size: ${compressedSize.toFixed(2)} MB`);
                logDebug(`Reduction: ${percentReduction}%`);
                
                // If compression didn't reduce size significantly, try the aggressive approach one more time
                if (compressedPdfBytes.length > pdfBytes.length * 0.9) { // Less than 10% reduction
                    logDebug('Standard compression insufficient, retrying deeper compression with lower quality');
                    
                    try {
                        statusText.textContent = 'Applying maximum compression...';
                        
                        // Use image-based rendering with lower quality
                        const finalBytes = await extractAndCompressImagesFromPDF(pdfBytes, 0.5, 0.6);
                        
                        // Quick validation
                        try {
                            const finalCheckTask = pdfjsLib.getDocument({ data: finalBytes });
                            const finalCheckDoc = await finalCheckTask.promise;
                            
                            if (finalCheckDoc.numPages === pageCount && 
                                finalBytes.length < pdfBytes.length * 0.8) { // At least 20% reduction
                                
                                const finalSize = finalBytes.length / 1024 / 1024;
                                const finalReduction = ((1 - (finalSize / originalSize)) * 100).toFixed(2);
                                
                                logDebug(`Final compression successful! Reduced by ${finalReduction}%`);
                                return finalBytes;
                            }
                        } catch (e) {
                            logDebug(`Final compression validation failed: ${e.message}`);
                        }
                    } catch (e) {
                        logDebug(`Final compression attempt failed: ${e.message}`);
                    }
                }
                
                // If we're here and the standard compression produced decent results, use it
                if (compressedPdfBytes.length < pdfBytes.length * 0.9) { // At least 10% reduction
                    logDebug('Using standard compression results');
                    return compressedPdfBytes;
                }
                
                // If all compression attempts did not significantly reduce size
                logDebug('All compression methods failed to significantly reduce size');
                return pdfBytes;
                
            } catch (e) {
                logDebug(`Error during compression: ${e.message}`);
                // If any error occurs, return the original file
                return pdfBytes;
            }
        } catch (error) {
            console.error('Error during compression:', error);
            // Always return something to avoid breaking the app
            return pdfBytes;
        }
    }

    // Download the compressed file
    downloadBtn.addEventListener('click', function() {
        if (!compressedPdfBytes) {
            showError("No compressed file available for download");
            return;
        }

        try {
            logDebug("Creating download for file: " + currentFileName);
            
            // Make sure we're working with a valid Uint8Array
            const pdfBytes = new Uint8Array(compressedPdfBytes);
            logDebug("PDF bytes length: " + pdfBytes.length);
            
            // Create blob with proper MIME type
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            logDebug("Created blob of size: " + blob.size);
            
            // Create download URL
            const url = URL.createObjectURL(blob);
            logDebug("Created object URL: " + url);
            
            // Use a more reliable download approach
            const filename = currentFileName.replace('.pdf', '_compressed.pdf');
            logDebug("Download filename: " + filename);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.target = '_blank'; // Open in new tab if download doesn't start
            
            // Add to DOM, click, and remove
            document.body.appendChild(link);
            link.click();
            
            // Small delay before cleanup
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(url);
                logDebug("Download cleanup complete");
            }, 100);
        } catch (error) {
            console.error("Download error:", error);
            showError("Failed to download: " + error.message);
        }
    });

    // Handle new file button
    newFileBtn.addEventListener('click', function() {
        resetUploadForm();
    });

    // Reset the upload form
    function resetUploadForm() {
        fileInput.value = '';
        currentFileName = null;
        originalPdfBytes = null;
        compressedPdfBytes = null;
        
        progressContainer.classList.add('d-none');
        resultsContainer.classList.add('d-none');
        uploadContainer.classList.remove('d-none');
        
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

// Advanced Image Compression Function
// Note: Client-side PDF image compression is limited compared to server-side
async function compressImage(imageData, quality = 0.7, maxWidth = 1200, maxHeight = 1200) {
    return new Promise((resolve, reject) => {
        try {
            // Create canvas to draw the image
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // Create image object
            const img = new Image();
            
            // Set up image loading handler
            img.onload = function() {
                // Calculate dimensions while preserving aspect ratio
                let width = img.width;
                let height = img.height;
                
                // Resize if larger than maximum dimensions
                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = height * (maxWidth / width);
                        width = maxWidth;
                    } else {
                        width = width * (maxHeight / height);
                        height = maxHeight;
                    }
                }
                
                // Set canvas size to calculated dimensions
                canvas.width = width;
                canvas.height = height;
                
                // Use bicubic interpolation for smoother resizing
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // Draw image on canvas at new dimensions
                ctx.drawImage(img, 0, 0, width, height);
                
                // Get compressed image data as base64 with specified quality
                const compressedData = canvas.toDataURL('image/jpeg', quality);
                
                // Resolve with the compressed data
                resolve(compressedData);
            };
            
            // Handle load errors
            img.onerror = function() {
                reject(new Error('Failed to load image for compression'));
            };
            
            // Set image source to the provided data
            img.src = imageData;
        } catch (error) {
            reject(error);
        }
    });
}

// Function to extract and compress images from a rendered PDF page
// This is the most aggressive compression method that re-renders each page as a JPEG
async function extractAndCompressImagesFromPDF(pdfBytes, imageScale = 0.6, imageQuality = 0.6) {
    try {
        logDebug(`Starting deep compression with scale=${imageScale}, quality=${imageQuality}`);
        
        // Load the PDF with PDF.js
        const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
        const pdfDoc = await loadingTask.promise;
        const pageCount = pdfDoc.numPages;
        
        logDebug(`Loaded PDF with ${pageCount} pages for deep compression`);
        
        // Create a new PDF document using pdf-lib
        const newPdfDoc = await PDFLib.PDFDocument.create();
        
        // Process each page
        for (let i = 0; i < pageCount; i++) {
            statusText.textContent = `Compressing page ${i + 1} of ${pageCount}...`;
            
            // Get the PDF page
            const page = await pdfDoc.getPage(i + 1);
            
            // Create a canvas for rendering
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            
            // Get page viewport at a reduced scale
            // For massive PDFs, we need to dramatically reduce the image size
            const originalViewport = page.getViewport({ scale: 1.0 });
            const scale = determineOptimalScale(originalViewport.width, originalViewport.height, imageScale);
            
            const viewport = page.getViewport({ scale: scale });
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            
            logDebug(`Rendering page ${i + 1} at scale ${scale} (${canvas.width}x${canvas.height})`);
            
            // Render the page to canvas with lowered quality
            await page.render({
                canvasContext: context,
                viewport: viewport
            }).promise;
            
            // Get canvas data as JPEG with reduced quality
            // Lower quality = smaller file size
            const pageImageData = canvas.toDataURL('image/jpeg', imageQuality);
            
            // Create a new page in the output PDF with original dimensions
            // We use the original page dimensions to ensure proper display
            const newPage = newPdfDoc.addPage([originalViewport.width, originalViewport.height]);
            
            try {
                // Convert the base64 image to a format usable by pdf-lib
                const jpgImageBytes = await fetch(pageImageData).then(res => res.arrayBuffer());
                const jpgImage = await newPdfDoc.embedJpg(jpgImageBytes);
                
                // Draw the compressed image on the page, stretching to fill the entire page
                newPage.drawImage(jpgImage, {
                    x: 0,
                    y: 0,
                    width: originalViewport.width,
                    height: originalViewport.height
                });
                
                logDebug(`Page ${i + 1} processed successfully`);
            } catch (pageError) {
                logDebug(`Error processing page ${i + 1}: ${pageError.message}`);
                // Continue with other pages even if one fails
            }
        }
        
        // Save the output PDF with maximum compression
        logDebug('Saving compressed PDF with aggressive settings');
        const compressedPdfBytes = await newPdfDoc.save({
            useObjectStreams: true,
            addDefaultPage: false,
            objectsPerTick: 10
        });
        
        const originalSize = pdfBytes.length / 1024 / 1024;
        const compressedSize = compressedPdfBytes.length / 1024 / 1024;
        const percentReduction = ((1 - (compressedSize / originalSize)) * 100).toFixed(2);
        
        logDebug(`Deep compression complete. Original: ${originalSize.toFixed(2)}MB, Compressed: ${compressedSize.toFixed(2)}MB, Reduction: ${percentReduction}%`);
        
        return compressedPdfBytes;
    } catch (error) {
        console.error('Error in extract and compress:', error);
        logDebug(`Deep compression failed: ${error.message}`);
        throw error;
    }
}

// Helper function to determine optimal scale based on page dimensions
function determineOptimalScale(width, height, baseScale = 0.6) {
    // For very large pages, use a more aggressive scale reduction
    const maxDimension = Math.max(width, height);
    
    if (maxDimension > 5000) {
        // Extremely large page
        return baseScale * 0.5; // 30% of original
    } else if (maxDimension > 3000) {
        // Very large page
        return baseScale * 0.7; // 42% of original
    } else if (maxDimension > 2000) {
        // Large page
        return baseScale * 0.8; // 48% of original
    } else {
        // Standard page
        return baseScale; // 60% of original by default
    }
}