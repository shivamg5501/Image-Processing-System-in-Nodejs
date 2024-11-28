const express = require('express');
const multer = require('multer');
const csvParser = require('csv-parser');
const mongoose = require('mongoose');
const sharp = require('sharp');
const fs = require('fs');
const axios = require('axios');
require('dotenv').config()
const app = express();
const upload = multer({ dest: 'uploads/' });

mongoose.connect(process.env.DATABASE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// schema for Mongoose
const productSchema = new mongoose.Schema({
  requestId: String,
  status: { type: String, default: 'processing' },
  products: [
    {
      serialNumber: Number,
      productName: String,
      inputImageUrls: [String],
      outputImageUrls: [String],
    },
  ],
});

const ProductRequest = mongoose.model('ProductRequest', productSchema);

app.post('/upload', upload.single('file'), async (req, res) => {
  const requestId = new mongoose.Types.ObjectId().toString();
  const products = [];
    console.log(req.file);
  fs.createReadStream(req.file.path)
    .pipe(csvParser())
    .on('data', (row) => {
      products.push({
        serialNumber: row['S. No.'],
        productName: row['Product Name'],
        inputImageUrls: row['Input Image Urls'].split(','),
        outputImageUrls: [],
      });
    })
    .on('end', async () => {
      const productRequest = new ProductRequest({ requestId, products });
      await productRequest.save();
        processImages(productRequest);
        res.json({ requestId });
        });
    });

    async function processImages(productRequest) {
    for (const product of productRequest.products) {
        for (const url of product.inputImageUrls) {
            // compressImage('https://example.com/path/to/your/image.jpg');
        const outputUrl = await compressImage(url);
        console.log('this is output url',outputUrl );
        product.outputImageUrls.push(outputUrl);
        }
    }
    productRequest.status = 'completed';
    await productRequest.save();
    }

    async function compressImage(imageUrl) {
        console.log("hello", imageUrl);
        
        try {
            const response = await axios({
                method: 'get',
                url: imageUrl,
                responseType: 'arraybuffer'
            });
            const compressedImageBuffer = await sharp(response.data) .resize(800, 800, { 
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ 
                quality: 80, 
                mozjpeg: true
            })
            .toBuffer();

        const base64Image = compressedImageBuffer.toString('base64');
        const outputUrl = `data:image/jpeg;base64,${base64Image}`;
        
        return outputUrl;
            // console.log('this is response', response);
            // const buffer = Buffer.from(response.data, 'binary');
            // console.log('this is buffer', buffer);
        } catch (error) {
            console.error('Error fetching the image:', error.message);
        }

    
    
    // Save the output image to a public URL or local storage
    // const outputUrl = 'the compresed url'; 
    // return outputUrl;
    }

// Status API
app.get('/status/:requestId', async (req, res) => {
  const productRequest = await ProductRequest.findOne({ requestId: req.params.requestId });
  if (!productRequest) {
    return res.status(404).json({ message: 'Request not found' });
  }
  res.json(productRequest);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
