/**
 * Simple OCR example using node-tesseract-ocr
 */
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const tesseract = require('node-tesseract-ocr');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const writeFile = promisify(fs.writeFile);
const unlink = promisify(fs.unlink);

const app = express();
app.use(bodyParser.json({ limit: '10mb' }));

// Supported image formats
const SUPPORTED_FORMATS = ['image/png', 'image/jpeg', 'image/tiff', 'image/bmp'];

// Configure tesseract options
const config = {
  lang: "eng",
  oem: 1,
  psm: 3,
};

function ensureTempDir() {
  const tmpDir = '/tmp';
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  return tmpDir;
}

async function validateImageFormat(buffer) {
  try {
    const fileType = await import('file-type');
    const type = await fileType.fileTypeFromBuffer(new Uint8Array(buffer));
    return type !== undefined && SUPPORTED_FORMATS.includes(type.mime);
  } catch (error) {
    console.error('Error validating image format:', error);
    return false;
  }
}

async function cleanupFile(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      await unlink(filePath);
    } catch (error) {
      console.error('Error cleaning up temp file:', error);
    }
  }
}

app.post('/detect', async (req, res) => {
  let imagePath = '';
  let cleanupRequired = false;
  
  try {
    const { imageUrl, imageBase64 } = req.body;
    
    if (!imageUrl && !imageBase64) {
      return res.status(400).json({ error: 'imageUrl or imageBase64 required' });
    }

    // Ensure temp directory exists
    const tmpDir = ensureTempDir();
    imagePath = path.join(tmpDir, `ocr-${Date.now()}.png`);
    cleanupRequired = true;
    
    let imageBuffer;
    if (imageUrl) {
      console.log('Fetching image from URL:', imageUrl);
      if (imageUrl.startsWith('file://')) {
        const filePath = imageUrl.replace('file://', '');
        try {
          imageBuffer = await fs.promises.readFile(filePath);
        } catch (error) {
          throw new Error(`Failed to read local file: ${error.message}`);
        }
      } else {
        const response = await fetch(imageUrl);
        if (!response.ok) {
          throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
      }
    } else {
      const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
      imageBuffer = Buffer.from(base64Data, 'base64');
    }
    
    // Validate image format
    if (!(await validateImageFormat(imageBuffer))) {
      throw new Error('Unsupported image format. Please provide PNG, JPEG, TIFF, or BMP images.');
    }
    
    // Save to temp file
    await writeFile(imagePath, new Uint8Array(imageBuffer));
    
    // Process the image
    console.log('Processing image...');
    let ocrResult;
    try {
      ocrResult = await tesseract.recognize(imagePath, config);
      console.log('Recognition complete. Result:', ocrResult);
    } catch (ocrError) {
      console.error('OCR Error:', ocrError);
      throw ocrError;
    }
    
    // Clean up the temp file
    if (cleanupRequired) {
      await cleanupFile(imagePath);
    }
    
    // Ensure we have a result
    if (!ocrResult || ocrResult.trim() === '') {
      console.warn('No text detected in image');
      return res.json({ text: '', warning: 'No text was detected in the image' });
    }
    
    return res.json({ text: ocrResult });
  } catch (error) {
    console.error('Error:', error);
    
    // Clean up temp file on error
    if (cleanupRequired) {
      await cleanupFile(imagePath);
    }
    
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'An error occurred during text detection',
      details: error instanceof Error ? error.stack : undefined
    });
  }
});

// Start the server
const listenPort = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(listenPort, () => {
  console.log(`Server running on port ${listenPort}`);
});

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  process.exit(0);
});