#!/usr/bin/env node
import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: 'YOUR_CLOUD_NAME', // ← replace this locally only
  api_key: 'YOUR_API_KEY', // ← replace this locally only
  api_secret: 'YOUR_API_SECRET', // ← replace this locally only; never commit a real API secret
});

async function run() {
  const uploadResult = await cloudinary.uploader.upload(
    'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    {
      folder: 'onboarding',
    }
  );

  console.log('Uploaded image secure URL:', uploadResult.secure_url);
  console.log('Uploaded image public ID:', uploadResult.public_id);

  const details = await cloudinary.api.resource(uploadResult.public_id);

  console.log('Image width:', details.width);
  console.log('Image height:', details.height);
  console.log('Image format:', details.format);
  console.log('Image file size in bytes:', details.bytes);

  const transformedUrl = cloudinary.url(uploadResult.public_id, {
    secure: true,
    fetch_format: 'auto', // f_auto: lets Cloudinary choose the best image format for the browser.
    quality: 'auto', // q_auto: lets Cloudinary choose the best quality/compression balance.
  });

  console.log('Done! Click link below to see optimized version of the image. Check the size and the format.');
  console.log(transformedUrl);
}

run().catch((error) => {
  console.error('Cloudinary onboarding failed:');
  console.error(error);
  process.exit(1);
});
