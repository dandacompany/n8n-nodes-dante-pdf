#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');

// Import the DocsConverter
const { DocsConverter } = require('./dist/converters/DocsConverter');

async function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(destPath);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        https.get(response.headers.location, (redirectResponse) => {
          redirectResponse.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        }).on('error', reject);
      } else {
        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }
    }).on('error', reject);
  });
}

async function testDocxConversion() {
  console.log('🧪 Testing DOCX to PDF Conversion');
  console.log('==================================\n');
  
  const testDir = path.join(__dirname, 'test-output');
  const docxPath = path.join(testDir, 'lorem_ipsum.docx');
  const pdfPath = path.join(testDir, 'lorem_ipsum_converted.pdf');
  
  try {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    
    // Step 1: Download the test DOCX file
    console.log('📥 Downloading test DOCX file from GitHub...');
    const url = 'https://github.com/felixlimanta/sample-docx-repo/raw/refs/heads/master/doc/lorem_ipsum.docx';
    await downloadFile(url, docxPath);
    
    const fileStats = fs.statSync(docxPath);
    console.log(`✅ Downloaded: ${docxPath} (${fileStats.size} bytes)\n`);
    
    // Step 2: Initialize the converter
    console.log('🔧 Initializing DocsConverter...');
    const converter = new DocsConverter();
    await converter.initialize();
    console.log('✅ Converter initialized\n');
    
    // Step 3: Read the DOCX file
    console.log('📖 Reading DOCX file...');
    const docxBuffer = fs.readFileSync(docxPath);
    console.log(`✅ Read ${docxBuffer.length} bytes\n`);
    
    // Step 4: Convert to PDF
    console.log('🔄 Converting DOCX to PDF...');
    console.log('  Options:');
    console.log('    - Format: A4');
    console.log('    - Preserve Images: true');
    console.log('    - Preserve Styles: true');
    
    const startTime = Date.now();
    
    const result = await converter.execute({
      file: {
        data: docxBuffer,
        fileName: 'lorem_ipsum.docx',  // Use fileName instead of name
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      },
      options: {
        format: 'A4',
        preserveImages: true,
        preserveStyles: true
      }
    });
    
    const conversionTime = Date.now() - startTime;
    console.log(`✅ Conversion completed in ${conversionTime}ms\n`);
    
    // Extract PDF buffer from result
    const pdfBuffer = result.pdf;
    
    // Step 5: Save the PDF
    console.log('💾 Saving PDF file...');
    fs.writeFileSync(pdfPath, pdfBuffer);
    
    const pdfStats = fs.statSync(pdfPath);
    console.log(`✅ Saved: ${pdfPath} (${pdfStats.size} bytes)\n`);
    
    // Step 6: Analyze the conversion
    console.log('📊 Conversion Analysis:');
    console.log('========================');
    console.log(`  Input size:  ${fileStats.size} bytes`);
    console.log(`  Output size: ${pdfStats.size} bytes`);
    console.log(`  Compression: ${((1 - pdfStats.size / fileStats.size) * 100).toFixed(1)}%`);
    console.log(`  Time taken:  ${conversionTime}ms`);
    console.log(`  Speed:       ${(fileStats.size / conversionTime).toFixed(0)} bytes/ms\n`);
    
    // Step 7: Content verification
    console.log('🔍 Content Verification:');
    console.log('========================');
    
    // Check if PDF was actually created
    if (pdfBuffer && pdfBuffer.length > 0 && pdfBuffer.toString('utf8', 0, 4) === '%PDF') {
      console.log('✅ Valid PDF header detected');
      console.log('✅ PDF structure appears valid');
    } else {
      console.log('❌ Invalid PDF structure');
    }
    
    // Check for common issues
    console.log('\n⚠️  Known Limitations:');
    console.log('  - PDFKit uses Helvetica font (no Korean support)');
    console.log('  - Complex DOCX formatting may be simplified');
    console.log('  - Tables converted to simple text representation');
    console.log('  - No support for embedded charts or shapes');
    
    // Cleanup
    await converter.cleanup();
    console.log('\n✅ Converter cleanup completed');
    
    console.log('\n🎉 Test completed successfully!');
    console.log(`📁 Output files saved in: ${testDir}`);
    console.log('  - lorem_ipsum.docx (original)');
    console.log('  - lorem_ipsum_converted.pdf (converted)');
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  }
}

// Run the test
testDocxConversion().catch(console.error);