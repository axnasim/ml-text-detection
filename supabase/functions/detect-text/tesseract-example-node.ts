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
const { fileTypeFromBuffer } = require('file-type');

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

function ensureTempDir(): string {
  const tmpDir = '/tmp';
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }
  return tmpDir;
}

async function validateImageFormat(buffer: Buffer): Promise<boolean> {
  const type = await fileTypeFromBuffer(new Uint8Array(buffer));
  return type !== undefined && SUPPORTED_FORMATS.includes(type.mime);
}

interface DetectRequest {
  imageUrl?: string;
  imageBase64?: string;
}

async function cleanupFile(filePath: string): Promise<void> {
  if (fs.existsSync(filePath)) {
    try {
      await unlink(filePath);
    } catch (error) {
      console.error('Error cleaning up temp file:', error);
    }
  }
}

app.post('/detect', async (req: Request, res: Response) => {
  let imagePath = '';
  let cleanupRequired = false;
  
  try {
    const { imageUrl, imageBase64 } = req.body as DetectRequest;
    
    if (!imageUrl && !imageBase64) {
      return res.status(400).json({ error: 'imageUrl or imageBase64 required' });
    }

    // Ensure temp directory exists
    const tmpDir = ensureTempDir();
    imagePath = path.join(tmpDir, `ocr-${Date.now()}.png`);
    cleanupRequired = true;
    
    let imageBuffer: Buffer;
    if (imageUrl) {
      console.log('Fetching image from URL:', imageUrl);
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
    } else {
      const base64Data = imageBase64!.replace(/^data:image\/\w+;base64,/, '');
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
    const ocrResult = await tesseract.recognize(imagePath, config);
    console.log('Recognition complete');
    
    // Clean up the temp file
    if (cleanupRequired) {
      await cleanupFile(imagePath);
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
    
    // Process the image
    console.log('Processing image...');
    const ocrResult = await tesseract.recognize(imagePath, config);
    console.log('Recognition complete');
    
    // Clean up the temp file
    if (cleanupRequired && fs.existsSync(imagePath)) {
      await unlink(imagePath);
      cleanupRequired = false;
    }
    
    return res.json({ text: ocrResult });
  } catch (error) {
    console.error('Error:', error);
    
    // Clean up temp file on error
    if (cleanupRequired && fs.existsSync(imagePath)) {
      try {
        await unlink(imagePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
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
    
  } catch (error) {
    console.error('Error:', error);
    
    // Clean up temp file on error
    if (cleanupRequired && fs.existsSync(imagePath)) {
      try {
        await unlink(imagePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }
    
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'An error occurred during text detection',
      details: error instanceof Error ? error.stack : undefined
    });
  }
});

// Start the server
const serverPort = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(serverPort, () => {
  console.log(`Server running on port ${serverPort}`);
});

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  process.exit(0);
    }

    console.log('Processing image...');
    const text = await tesseract.recognize(imagePath, config);
    console.log('Recognition complete');

    // Clean up temp file
    if (fs.existsSync(imagePath)) {
      await unlink(imagePath);
    }

    return res.json({ text });
  } catch (error: any) {
    console.error('Error:', error);
    
    // Clean up temp file on error
    if (imagePath && fs.existsSync(imagePath)) {
      try {
        await unlink(imagePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }

    return res.status(500).json({ 
      error: error.message || 'An error occurred during text detection',
      details: error.stack
    });
  }
});

// Start the server
const serverPort = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(serverPort, () => {
  console.log(`Server running on port ${serverPort}`);
});

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  process.exit(0);
});
    }

    console.log('Processing image...');
    const text = await tesseract.recognize(imagePath, config);
    console.log('Recognition complete');

    // Clean up temp file
    if (imagePath && fs.existsSync(imagePath)) {
      await unlink(imagePath);
    }

    return res.json({ text });
  } catch (error: any) {
    console.error('Error:', error);
    
    // Clean up temp file on error
    if (imagePath && fs.existsSync(imagePath)) {
      try {
        await unlink(imagePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }

    return res.status(500).json({ 
      error: error.message || 'An error occurred during text detection',
      details: error.stack
    });
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Handle cleanup on exit
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  process.exit(0);
});

    console.log('Processing image...');
    const text = await tesseract.recognize(imagePath, config);
    console.log('Recognition complete');

    // Clean up temp file
    if (imagePath && fs.existsSync(imagePath)) {
      await unlink(imagePath);
    }

    return res.json({ text });

  } catch (error: any) {
    console.error('Error:', error);
    
    // Clean up temp file on error
    if (imagePath && fs.existsSync(imagePath)) {
      try {
        await unlink(imagePath);
      } catch (cleanupError) {
        console.error('Error cleaning up temp file:', cleanupError);
      }
    }

    return res.status(500).json({ 
      error: error.message || 'An error occurred during text detection',
      details: error.stack
    });
  }

    console.log('Processing image...');
    const text = await tesseract.recognize(imagePath, config);
    console.log('Recognition complete');
    
    // Clean up temp file
    require('fs').unlinkSync(imagePath);
    
    return res.json({ 
      success: true,
      text: text
    });
  } catch (error: any) {
    console.error('Error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;
app.listen(port, () => {
  console.log(`OCR example server listening on http://localhost:${port}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('Shutting down...');
  process.exit(0);
});
