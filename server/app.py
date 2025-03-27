import os
import logging
from flask import Flask, render_template, request, jsonify, send_file, session
import tempfile
import uuid
import compressor

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

# Create the app
app = Flask(__name__)
app.secret_key = os.environ.get("SESSION_SECRET", "default-dev-secret")

# Create temporary directory for storing files if it doesn't exist
TEMP_DIR = os.path.join(tempfile.gettempdir(), 'pdf_compressor')
if not os.path.exists(TEMP_DIR):
    os.makedirs(TEMP_DIR)

# Clean up old temporary files (older than 1 hour) on startup
compressor.cleanup_temp_files(TEMP_DIR)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    if not file.filename.lower().endswith('.pdf'):
        return jsonify({'error': 'Only PDF files are supported'}), 400
    
    # Generate unique ID for this upload
    file_id = str(uuid.uuid4())
    session['file_id'] = file_id
    
    # Save original file
    original_path = os.path.join(TEMP_DIR, f"{file_id}_original.pdf")
    file.save(original_path)
    
    # Get file size
    original_size = os.path.getsize(original_path) / (1024 * 1024)  # Size in MB
    
    # Check file size limit (100MB)
    if original_size > 100:
        os.remove(original_path)
        return jsonify({'error': 'File size exceeds the 100MB limit'}), 400
    
    # Return information about the original file
    return jsonify({
        'success': True,
        'fileId': file_id,
        'originalSize': round(original_size, 2),
        'originalName': file.filename
    })

@app.route('/compress', methods=['POST'])
def compress_file():
    data = request.json
    file_id = data.get('fileId')
    
    if not file_id:
        return jsonify({'error': 'File ID not provided'}), 400
    
    original_path = os.path.join(TEMP_DIR, f"{file_id}_original.pdf")
    compressed_path = os.path.join(TEMP_DIR, f"{file_id}_compressed.pdf")
    
    if not os.path.exists(original_path):
        return jsonify({'error': 'Original file not found'}), 404
    
    try:
        # Compress the PDF
        result = compressor.compress_pdf(original_path, compressed_path)
        
        if result['success']:
            original_size = os.path.getsize(original_path) / (1024 * 1024)  # Size in MB
            compressed_size = os.path.getsize(compressed_path) / (1024 * 1024)  # Size in MB
            
            return jsonify({
                'success': True,
                'fileId': file_id,
                'originalSize': round(original_size, 2),
                'compressedSize': round(compressed_size, 2),
                'compressionRatio': round(original_size / max(compressed_size, 0.01), 2),
                'percentReduction': round((1 - (compressed_size / original_size)) * 100, 2)
            })
        else:
            return jsonify({'error': result['error']}), 500
    except Exception as e:
        logger.error(f"Compression error: {str(e)}")
        return jsonify({'error': f'Compression failed: {str(e)}'}), 500

@app.route('/download/<file_id>', methods=['GET'])
def download_file(file_id):
    compressed_path = os.path.join(TEMP_DIR, f"{file_id}_compressed.pdf")
    
    if not os.path.exists(compressed_path):
        return jsonify({'error': 'Compressed file not found'}), 404
    
    original_path = os.path.join(TEMP_DIR, f"{file_id}_original.pdf")
    if os.path.exists(original_path):
        original_name = os.path.basename(original_path)
        download_name = original_name.replace('_original.pdf', '_compressed.pdf')
    else:
        download_name = f"{file_id}_compressed.pdf"
    
    return send_file(
        compressed_path,
        as_attachment=True,
        download_name=download_name,
        mimetype='application/pdf'
    )

@app.errorhandler(413)
def request_entity_too_large(error):
    return jsonify({'error': 'File size exceeds maximum limit'}), 413

@app.errorhandler(500)
def server_error(error):
    return jsonify({'error': 'Server error occurred'}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
