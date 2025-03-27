# PDF Compressor - Complete Package

This package contains two versions of the PDF Compressor application:

1. **Server Version** - A Flask-based web application that uses server-side compression with pikepdf
2. **GitHub Pages Version** - A static website that uses client-side JavaScript for compression

## Server Version (Python/Flask)

The server version performs compression on the server using Python libraries, which gives better compression results for complex PDFs.

### Features
- Server-side compression using pikepdf
- More powerful compression algorithms
- Handles complex PDFs better
- Requires a server to run

### Requirements
- Python 3.8+
- Flask
- pikepdf
- Pillow
- gunicorn (for production)

### Running Locally
```
cd server
pip install flask pikepdf pillow gunicorn
python main.py
```

## GitHub Pages Version (Static HTML/JavaScript)

The GitHub Pages version runs entirely in the browser and doesn't require a server.

### Features
- Client-side compression using JavaScript
- No server required
- Can be hosted on GitHub Pages or any static hosting
- Works offline

### Deployment
See the `HOSTING_INSTRUCTIONS.md` file in the GitHub Pages folder for detailed instructions.

## Choosing the Right Version

- Use the **Server Version** if you need better compression for complex PDFs and have a server to host it.
- Use the **GitHub Pages Version** if you want a simple solution with no server requirements.