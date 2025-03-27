# PDF Compressor - Server Version

This is the server-side implementation of the PDF Compressor, which uses Python's pikepdf library for powerful PDF compression.

## Features

- Server-side PDF compression using pikepdf
- Image optimization in PDFs (resolution and quality reduction)
- Metadata cleanup and structure optimization
- Web interface for uploading and downloading PDFs

## Requirements

- Python 3.8+
- Flask
- pikepdf
- Pillow
- gunicorn (for production)

## Installation

```bash
pip install -r requirements.txt
```

## Running Locally

```bash
python main.py
```

The application will be available at http://localhost:5000

## Production Deployment

For production deployment, use a WSGI server like gunicorn:

```bash
gunicorn --bind 0.0.0.0:5000 main:app
```

## How It Works

1. User uploads a PDF file
2. The server saves the file temporarily
3. The compression algorithm:
   - Optimizes embedded images (reduces resolution and quality)
   - Removes unnecessary metadata
   - Applies PDF compression features
4. The compressed file is provided for download
5. Temporary files are automatically cleaned up after 1 hour

## Customization

You can modify the compression settings in `compressor.py`:

- `image_quality` - JPEG quality (0-100) for embedded images
- `target_dpi` - Target resolution for images (lower = smaller file size)