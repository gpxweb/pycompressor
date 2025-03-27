import os
import logging
import time
from datetime import datetime, timedelta
from PIL import Image
import io
import pikepdf
import tempfile
import shutil

# Configure logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def cleanup_temp_files(temp_dir, hours=1):
    """Clean up temporary files older than specified hours"""
    try:
        now = datetime.now()
        cutoff = now - timedelta(hours=hours)
        
        for filename in os.listdir(temp_dir):
            filepath = os.path.join(temp_dir, filename)
            file_mod_time = datetime.fromtimestamp(os.path.getmtime(filepath))
            if file_mod_time < cutoff:
                os.remove(filepath)
                logger.debug(f"Removed old temp file: {filepath}")
    except Exception as e:
        logger.error(f"Error cleaning up temp files: {str(e)}")

def optimize_image(img, target_dpi=150, quality=85):
    """Optimize an image by reducing resolution and quality"""
    # Determine new size based on target DPI
    original_dpi = max(img.info.get('dpi', (72, 72)))
    if original_dpi < target_dpi:
        # If image is already below target DPI, don't upscale
        return img
    
    scale_factor = target_dpi / original_dpi
    new_size = (int(img.width * scale_factor), int(img.height * scale_factor))
    
    # Resize the image
    img = img.resize(new_size, Image.LANCZOS)
    
    return img

def compress_pdf(input_path, output_path, image_quality=85, target_dpi=150):
    """
    Compress PDF by:
    1. Optimizing embedded images
    2. Removing unnecessary metadata
    3. Applying PDF compression options
    """
    try:
        temp_dir = tempfile.mkdtemp()
        
        # Step 1: Open the PDF with pikepdf
        with pikepdf.open(input_path) as pdf:
            # Step 2: Process each page
            for page_num, page in enumerate(pdf.pages):
                process_page(page, temp_dir, page_num, image_quality, target_dpi)
            
            # Step 3: Remove unnecessary metadata and compress
            pdf.remove_unreferenced_resources()
            
            # Step 4: Save the compressed PDF
            pdf.save(output_path, 
                    compress_streams=True,
                    preserve_pdfa=False,
                    object_stream_mode=pikepdf.ObjectStreamMode.generate,
                    normalize_content=True,
                    linearize=False)
        
        # Step 5: Clean up temporary directory
        shutil.rmtree(temp_dir)
        
        return {"success": True}
    
    except Exception as e:
        logger.error(f"Error compressing PDF: {str(e)}")
        # Clean up temporary directory if it exists
        if os.path.exists(temp_dir):
            shutil.rmtree(temp_dir)
        return {"success": False, "error": str(e)}

def process_page(page, temp_dir, page_num, image_quality, target_dpi):
    """Process a single PDF page to optimize images"""
    try:
        # Get all images on the page (via page resources)
        if '/Resources' in page and '/XObject' in page['/Resources']:
            xobjects = page['/Resources']['/XObject']
            
            # Iterate through all XObjects (which might be images)
            for key, xobject in xobjects.items():
                # Check if XObject is an image
                if xobject.get('/Subtype') == '/Image':
                    optimize_image_object(xobject, key, temp_dir, page_num, image_quality, target_dpi)
    
    except Exception as e:
        logger.error(f"Error processing page {page_num}: {str(e)}")

def optimize_image_object(xobject, key, temp_dir, page_num, image_quality, target_dpi):
    """Optimize an image XObject in the PDF"""
    try:
        # Check if this is an image we can process
        if xobject.get('/Subtype') != '/Image':
            return
        
        # Get image properties
        color_space = xobject.get('/ColorSpace', '/DeviceRGB')
        bit_depth = xobject.get('/BitsPerComponent', 8)
        
        # Skip small or already optimized images
        width = xobject.get('/Width', 0)
        height = xobject.get('/Height', 0)
        if width * height < 10000:  # Skip tiny images
            return
            
        # Try to extract image data
        img = None
        
        # Check image format
        if '/Filter' in xobject:
            filters = xobject['/Filter']
            
            # Convert single filter to list for uniform processing
            if not isinstance(filters, list):
                filters = [filters]
            
            filter_names = [str(f) for f in filters]
            
            # DCTDecode is JPEG
            if '/DCTDecode' in filter_names:
                try:
                    img_data = xobject.read_raw_bytes()
                    img = Image.open(io.BytesIO(img_data))
                    
                    # Optimize the image
                    img = optimize_image(img, target_dpi, image_quality)
                    
                    # Save back as JPEG
                    output = io.BytesIO()
                    img.save(output, format='JPEG', quality=image_quality, optimize=True)
                    xobject.write(output.getvalue(), filter=pikepdf.Name.DCTDecode)
                except Exception as e:
                    logger.error(f"Error processing JPEG image: {str(e)}")
            
            # FlateDecode or other filters for raw images
            elif '/FlateDecode' in filter_names:
                try:
                    # This is more complex as we need to handle different color spaces
                    # Let's process RGB and Gray images
                    if str(color_space) in ['/DeviceRGB', '/DeviceGray']:
                        channels = 3 if str(color_space) == '/DeviceRGB' else 1
                        img_data = xobject.read_raw_bytes()
                        
                        if channels == 1:
                            mode = 'L'
                        else:
                            mode = 'RGB'
                        
                        # Create PIL Image from raw data
                        img = Image.frombytes(mode, (width, height), img_data)
                        
                        # Optimize the image
                        img = optimize_image(img, target_dpi, image_quality)
                        
                        # Save as JPEG (with compression)
                        output = io.BytesIO()
                        img.save(output, format='JPEG', quality=image_quality, optimize=True)
                        
                        # Replace original image with compressed JPEG
                        xobject.write(output.getvalue(), filter=pikepdf.Name.DCTDecode)
                except Exception as e:
                    logger.error(f"Error processing raw image: {str(e)}")
    
    except Exception as e:
        logger.error(f"Error optimizing image: {str(e)}")
