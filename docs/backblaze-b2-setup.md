# Backblaze B2 Storage Setup

This document explains how the Yeshiva Toras Chaim alumni website uses Backblaze B2 for storing shiur audio files and PDF materials.

## Overview

All shiur recordings (audio files) and mareh mekomos (PDF documents) are stored on Backblaze B2 cloud storage. This provides:
- **Reliable storage** - Professional-grade file hosting
- **Cost-effective** - Much cheaper than alternatives for large media files
- **Fast delivery** - Quick access to audio and PDF files for users

## Backblaze B2 Configuration

The application is configured with the following Backblaze B2 credentials:

- **Key ID**: `7ff2de81b0a3`
- **Key Name**: Master Application Key
- **Application Key**: `005ed4d1cbf04e9ea8bade632193ef3aec2120da42`
- **Endpoint**: `https://s3.us-west-004.backblazeb2.com`
- **Region**: `us-west-004`
- **Bucket Name**: `ytc-shiurim` (you need to create this in your Backblaze account)

## Setting Up Your Bucket

1. Log in to your Backblaze B2 account
2. Create a new bucket named `ytc-shiurim`
3. Set bucket privacy to **Public** (so shiur files are accessible to approved users)
4. Enable CORS if needed for direct browser access

## How File Upload Works

When an admin uploads a shiur:

1. Admin selects audio file (MP3, M4A) and/or PDF file in the admin dashboard
2. Files are sent to `/api/upload-shiur-file` route
3. The API route uses the `uploadToB2()` function from `lib/backblaze.ts`
4. Files are uploaded to Backblaze B2 in organized folders:
   - Audio files: `audio/{timestamp}-{filename}`
   - PDF files: `pdf/{timestamp}-{filename}`
5. The public URL and key are stored in Firestore with the shiur metadata

## File Storage Structure

\`\`\`
ytc-shiurim/
├── audio/
│   ├── 1234567890-gemara-shiur.mp3
│   ├── 1234567891-halacha-class.m4a
│   └── ...
└── pdf/
    ├── 1234567890-mareh-mekomos.pdf
    ├── 1234567891-sources.pdf
    └── ...
\`\`\`

## API Integration

### Upload File

**Endpoint**: `POST /api/upload-shiur-file`

**Request**: `multipart/form-data`
- `file`: The file to upload
- `type`: Either "audio" or "pdf"

**Response**:
\`\`\`json
{
  "url": "https://s3.us-west-004.backblazeb2.com/ytc-shiurim/audio/1234567890-file.mp3",
  "key": "audio/1234567890-file.mp3"
}
\`\`\`

### Backblaze Helper Functions

Located in `lib/backblaze.ts`:

- `uploadToB2(file, folder)` - Upload a file to B2
- `getPresignedUrl(key, expiresIn)` - Generate temporary access URL (optional)
- `deleteFromB2(key)` - Delete a file from B2
- `getKeyFromUrl(url)` - Extract the file key from a full URL

## Security Notes

- The application key has full access to the bucket
- Files are stored in public bucket for easy access
- Consider implementing signed URLs for private content if needed
- Store credentials securely (environment variables in production)

## Cost Considerations

Backblaze B2 pricing (as of 2024):
- Storage: $0.005/GB/month
- Download: $0.01/GB
- Free tier: 10GB storage, 1GB/day downloads

Estimated costs for typical use:
- 100 shiurim @ 50MB each = 5GB storage = $0.025/month
- 500 downloads/month = 25GB = $0.25/month
- **Total: ~$0.30/month**

## Troubleshooting

### Upload Fails
- Check that bucket name is correct (`ytc-shiurim`)
- Verify credentials are accurate
- Ensure bucket is created in your Backblaze account

### Files Not Accessible
- Check bucket privacy settings (should be Public)
- Verify CORS settings if accessing from browser
- Check that file URLs are being saved correctly in Firestore

### Performance Issues
- Consider using Backblaze CDN for faster delivery
- Implement caching headers for frequently accessed files

## Future Enhancements

- Add file compression before upload
- Implement automatic transcription of shiurim
- Add thumbnail generation for video shiurim
- Set up lifecycle policies to archive old files
